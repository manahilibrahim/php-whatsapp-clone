<?php
// php-backend/public/index.php
// Simple router for REST endpoints
require_once __DIR__ . '/../config.php';

// CORS for browser clients
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$pdo = db();

switch (true) {
  // Health
  case $method === 'GET' && $path === '/':
    json(['ok' => true, 'service' => 'whatsapp-php-backend']);

  // Auth: Register
  case $method === 'POST' && $path === '/register':
    $data = body_json();
    $phone = trim($data['phone'] ?? '');
    $name = trim($data['name'] ?? '');
    $password = $data['password'] ?? '';
    if (!$phone || !$name || !$password) json(['error' => 'Missing fields'], 400);
    $hash = password_hash($password, PASSWORD_BCRYPT);
    try {
      $stmt = $pdo->prepare('INSERT INTO users (phone, name, password_hash) VALUES (?, ?, ?)');
      $stmt->execute([$phone, $name, $hash]);
      json(['ok' => true]);
    } catch (PDOException $e) {
      json(['error' => 'Phone already in use'], 409);
    }

  // Auth: Login
  case $method === 'POST' && $path === '/login':
    $data = body_json();
    $phone = trim($data['phone'] ?? '');
    $password = $data['password'] ?? '';
    $stmt = $pdo->prepare('SELECT id, phone, name, password_hash FROM users WHERE phone = ?');
    $stmt->execute([$phone]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
      json(['error' => 'Invalid credentials'], 401);
    }
    $token = bin2hex(random_bytes(24));
    $upd = $pdo->prepare('UPDATE users SET api_token = ? WHERE id = ?');
    $upd->execute([$token, $user['id']]);
    json(['token' => $token, 'user' => ['id' => (int)$user['id'], 'phone' => $user['phone'], 'name' => $user['name']]]);

  // Get me
  case $method === 'GET' && $path === '/me':
    $me = require_auth();
    json(['user' => $me]);

  // Contacts: list
  case $method === 'GET' && $path === '/contacts':
    $me = require_auth();
    $sql = 'SELECT u.id, u.name, u.phone FROM contacts c JOIN users u ON u.id = c.contact_id WHERE c.user_id = ? ORDER BY u.name';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$me['id']]);
    json(['contacts' => $stmt->fetchAll()]);

  // Contacts: add by phone
  case $method === 'POST' && $path === '/contacts':
    $me = require_auth();
    $data = body_json();
    $phone = trim($data['phone'] ?? '');
    $stmt = $pdo->prepare('SELECT id FROM users WHERE phone = ?');
    $stmt->execute([$phone]);
    $other = $stmt->fetch();
    if (!$other) json(['error' => 'User not found'], 404);
    if ($other['id'] == $me['id']) json(['error' => 'Cannot add yourself'], 400);
    try {
      $ins = $pdo->prepare('INSERT INTO contacts (user_id, contact_id) VALUES (?, ?)');
      $ins->execute([$me['id'], $other['id']]);
    } catch (PDOException $e) { /* ignore duplicate */ }
    json(['ok' => true]);

  // Messages: list thread with contact_id
  case $method === 'GET' && preg_match('#^/messages/(\d+)$#', $path, $m):
    $me = require_auth();
    $otherId = (int)$m[1];
    $sql = 'SELECT id, sender_id, receiver_id, content, status, created_at FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY id ASC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$me['id'], $otherId, $otherId, $me['id']]);
    json(['messages' => $stmt->fetchAll()]);

  // Messages: send
  case $method === 'POST' && $path === '/messages':
    $me = require_auth();
    $data = body_json();
    $to = (int)($data['to'] ?? 0);
    $content = trim($data['content'] ?? '');
    if (!$to || $content === '') json(['error' => 'Missing to/content'], 400);
    $ins = $pdo->prepare('INSERT INTO messages (sender_id, receiver_id, content, status) VALUES (?, ?, ?, "sent")');
    $ins->execute([$me['id'], $to, $content]);
    $msgId = (int)$pdo->lastInsertId();
    // Optionally, push to WebSocket notifier (external process) via Redis, etc.
    json(['ok' => true, 'message' => ['id' => $msgId, 'sender_id' => $me['id'], 'receiver_id' => $to, 'content' => $content, 'status' => 'sent', 'created_at' => date('Y-m-d H:i:s')]]);

  // Calls: history list
  case $method === 'GET' && $path === '/calls':
    $me = require_auth();
    $sql = 'SELECT * FROM calls WHERE caller_id = ? OR callee_id = ? ORDER BY id DESC LIMIT 100';
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$me['id'], $me['id']]);
    json(['calls' => $stmt->fetchAll()]);

  // Calls: record update/create
  case $method === 'POST' && $path === '/calls':
    $me = require_auth();
    $data = body_json();
    $callee = (int)($data['callee_id'] ?? 0);
    $status = $data['status'] ?? 'initiated';
    $started = $data['started_at'] ?? null;
    $ended = $data['ended_at'] ?? null;
    if (!$callee) json(['error' => 'Missing callee_id'], 400);
    $ins = $pdo->prepare('INSERT INTO calls (caller_id, callee_id, status, started_at, ended_at) VALUES (?, ?, ?, ?, ?)');
    $ins->execute([$me['id'], $callee, $status, $started, $ended]);
    json(['ok' => true]);

  default:
    json(['error' => 'Not found', 'path' => $path], 404);
}