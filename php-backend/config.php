<?php
// php-backend/config.php
// Basic PDO connection and helpers. Adjust DB creds via environment variables when deploying.

$DB_HOST = getenv('DB_HOST') ?: '127.0.0.1';
$DB_NAME = getenv('DB_NAME') ?: 'whatsapp_clone';
$DB_USER = getenv('DB_USER') ?: 'root';
$DB_PASS = getenv('DB_PASS') ?: '';
$DB_PORT = getenv('DB_PORT') ?: '3306';

function db() {
  static $pdo = null;
  global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS, $DB_PORT;
  if ($pdo === null) {
    $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
    $options = [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ];
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, $options);
  }
  return $pdo;
}

function json($data, $status = 200) {
  http_response_code($status);
  header('Content-Type: application/json');
  echo json_encode($data);
  exit;
}

function getBearerToken() {
  $headers = null;
  if (isset($_SERVER['Authorization'])) {
    $headers = trim($_SERVER['Authorization']);
  } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) { // Nginx or fast CGI
    $headers = trim($_SERVER['HTTP_AUTHORIZATION']);
  } elseif (function_exists('apache_request_headers')) {
    $requestHeaders = apache_request_headers();
    $requestHeaders = array_combine(array_map('ucwords', array_keys($requestHeaders)), array_values($requestHeaders));
    if (isset($requestHeaders['Authorization'])) {
      $headers = trim($requestHeaders['Authorization']);
    }
  }
  if (!empty($headers) && preg_match('/Bearer\s(.*)$/i', $headers, $matches)) {
    return $matches[1];
  }
  return null;
}

function require_auth() {
  $pdo = db();
  $token = getBearerToken();
  if (!$token) {
    json(['error' => 'Unauthorized'], 401);
  }
  $stmt = $pdo->prepare('SELECT id, phone, name FROM users WHERE api_token = ?');
  $stmt->execute([$token]);
  $user = $stmt->fetch();
  if (!$user) {
    json(['error' => 'Invalid token'], 401);
  }
  return $user; // [id, phone, name]
}

function body_json() {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}