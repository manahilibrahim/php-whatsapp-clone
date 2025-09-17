<?php
// php-backend/websocket/server.php
// WebSocket signaling + messaging stub using Ratchet
// Requires composer deps: cboden/ratchet
// Run: php vendor/bin/ratchet-server.php (or see bootstrap below)

require __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../config.php';

use Ratchet\Http\HttpServer;
use Ratchet\Server\IoServer;
use Ratchet\WebSocket\WsServer;
use Ratchet\ConnectionInterface;
use Ratchet\MessageComponentInterface;

class ChatServer implements MessageComponentInterface {
  protected $clients; // SplObjectStorage of connections
  protected $users;   // connId => userId

  public function __construct() {
    $this->clients = new \SplObjectStorage;
    $this->users = [];
  }

  public function onOpen(ConnectionInterface $conn) {
    $this->clients->attach($conn);
  }

  public function onMessage(ConnectionInterface $from, $msg) {
    $data = json_decode($msg, true);
    if (!$data) return;

    if (($data['type'] ?? '') === 'auth') {
      // Validate token -> user
      $token = $data['token'] ?? '';
      $pdo = db();
      $stmt = $pdo->prepare('SELECT id FROM users WHERE api_token = ?');
      $stmt->execute([$token]);
      $user = $stmt->fetch();
      if ($user) {
        $this->users[$from->resourceId] = (int)$user['id'];
        $from->send(json_encode(['type' => 'auth_ok', 'user_id' => (int)$user['id']]));
      } else {
        $from->send(json_encode(['type' => 'auth_error']));
      }
      return;
    }

    $userId = $this->users[$from->resourceId] ?? null;
    if (!$userId) return;

    // Relay messages between users (chat + WebRTC signaling)
    $to = (int)($data['to'] ?? 0);
    $type = $data['type'] ?? '';

    foreach ($this->clients as $client) {
      if ($client === $from) continue;
      $toUser = $this->users[$client->resourceId] ?? null;
      if ($toUser && $toUser === $to) {
        $payload = $data;
        $payload['from'] = $userId;
        $client->send(json_encode($payload));
      }
    }

    if ($type === 'chat') {
      // Persist chat message to DB
      $content = trim($data['content'] ?? '');
      if ($content !== '' && $to) {
        $pdo = db();
        $ins = $pdo->prepare('INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)');
        $ins->execute([$userId, $to, $content]);
      }
    }
  }

  public function onClose(ConnectionInterface $conn) {
    unset($this->users[$conn->resourceId]);
    $this->clients->detach($conn);
  }

  public function onError(ConnectionInterface $conn, \Exception $e) {
    $conn->close();
  }
}

$port = (int)(getenv('WS_PORT') ?: 8080);
$server = IoServer::factory(new HttpServer(new WsServer(new ChatServer())), $port);
echo "WebSocket server running on :{$port}\n";
$server->run();