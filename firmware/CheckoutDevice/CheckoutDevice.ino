#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>
#include <time.h>
#include "root_ca.h"
#if __has_include("secrets.h")
#include "secrets.h"
#else
#include "secrets.example.h"
#endif

constexpr uint8_t PIR_PIN = 27, SS_PIN = 21, RST_PIN = 22;
MFRC522 reader(SS_PIN, RST_PIN);
struct SensorEvent { uint32_t sequence; uint32_t createdAt; char type[20]; char uid[21]; };
QueueHandle_t events;
char bootId[17];
uint32_t sequence = 0, lastHeartbeat = 0, lastPoll = 0, lastCardSeen = 0;
bool pirWasHigh = false, readerReady = false;
String heldUid;

void enqueue(const char* type, const char* uid = "") {
  SensorEvent event = {};
  event.sequence = ++sequence; event.createdAt = millis();
  strlcpy(event.type, type, sizeof(event.type)); strlcpy(event.uid, uid, sizeof(event.uid));
  if (xQueueSend(events, &event, 0) != pdPASS) {
    Serial.println("[QUEUE FULL] Event discarded. Please scan again."); return;
  }
  Serial.printf("[EVENT %lu] %s %s\n", (unsigned long)event.sequence, event.type, event.uid);
}

void networkTask(void*) {
  WiFi.mode(WIFI_STA); WiFi.setAutoReconnect(true); WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uint32_t reconnectAt = millis(); bool clockStarted = false;
  SensorEvent current; bool pending = false;
  for (;;) {
    if (!pending) pending = xQueueReceive(events, &current, pdMS_TO_TICKS(50)) == pdPASS;
    if (pending && millis() - current.createdAt > 10000) {
      Serial.println("[EXPIRED] Delivery failed within 10 s. Please scan again."); pending = false;
    }
    if (WiFi.status() != WL_CONNECTED) {
      if (millis() - reconnectAt > 5000) { Serial.println("[WIFI] Reconnecting..."); WiFi.disconnect(); WiFi.begin(WIFI_SSID, WIFI_PASSWORD); reconnectAt = millis(); }
      vTaskDelay(pdMS_TO_TICKS(100)); continue;
    }
    if (!clockStarted) { configTime(0, 0, "pool.ntp.org", "time.google.com"); clockStarted = true; Serial.println("[WIFI] Connected. Waiting for clock synchronization."); }
    if (!pending || time(nullptr) < 1735689600) { vTaskDelay(pdMS_TO_TICKS(50)); continue; }
    WiFiClientSecure client; client.setCACert(ROOT_CA); client.setTimeout(3); client.setHandshakeTimeout(4);
    HTTPClient http; http.setConnectTimeout(2500); http.setTimeout(2500);
    if (!http.begin(client, EVENT_URL)) { Serial.println("[HTTPS] Unable to initialize endpoint.");vTaskDelay(pdMS_TO_TICKS(700));continue; }
    http.addHeader("Content-Type", "application/json"); http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
    if (strlen(VERCEL_BYPASS)) http.addHeader("x-vercel-protection-bypass", VERCEL_BYPASS);
    JsonDocument body; body["deviceId"] = DEVICE_ID; body["bootId"] = bootId;
    body["sequence"] = current.sequence; body["type"] = current.type; body["ageMs"] = millis() - current.createdAt;
    if (current.uid[0]) body["uid"] = current.uid;
    String payload; serializeJson(body, payload);
    int status = http.POST(payload);
    if (status == 200) { Serial.printf("[SENT %lu] OK\n", (unsigned long)current.sequence);pending = false; }
    else {
      Serial.printf("[HTTP %d] Check endpoint, credentials, TLS certificate and Redis.\n", status);
      if (status >= 400 && status < 500 && status != 429) pending = false;
    }
    http.end();vTaskDelay(pdMS_TO_TICKS(pending ? 700 : 30));
  }
}

void setup() {
  Serial.begin(115200); pinMode(PIR_PIN, INPUT);
  SPI.begin(18, 19, 23, SS_PIN); reader.PCD_Init(); delay(50);
  byte version = reader.PCD_ReadRegister(MFRC522::VersionReg);
  readerReady = version != 0 && version != 0xFF;
  reader.PCD_DumpVersionToSerial();
  if (!readerReady) Serial.println("[RFID ERROR] Check wiring and 3.3 V power. Restart after fixing.");
  snprintf(bootId, sizeof(bootId), "%08lx%08lx", (unsigned long)esp_random(), (unsigned long)esp_random());
  events = xQueueCreate(20, sizeof(SensorEvent));
  if (!events) { Serial.println("Queue allocation failed."); while(true) delay(1000); }
  xTaskCreatePinnedToCore(networkTask, "event-network", 12288, nullptr, 1, nullptr, 0);
  Serial.println("PIR warming up for 10 seconds; RFID ready. No cloud keys are printed.");
}

void loop() {
  uint32_t now = millis();
  bool pirHigh = digitalRead(PIR_PIN) == HIGH;
  if (now > 10000 && pirHigh && !pirWasHigh) enqueue("person_detected");
  pirWasHigh = pirHigh;
  if (now - lastHeartbeat >= 15000) { enqueue("heartbeat"); lastHeartbeat = now; }
  if (readerReady && now - lastPoll >= 80) {
    lastPoll = now;
    // Wake halted cards too, so one card held in place is not counted repeatedly.
    byte atqa[2]; byte size = sizeof(atqa);
    auto result = reader.PICC_WakeupA(atqa, &size);
    if ((result == MFRC522::STATUS_OK || result == MFRC522::STATUS_COLLISION) && reader.PICC_ReadCardSerial()) {
      String uid;
      for (byte i=0; i<reader.uid.size; i++) { if (reader.uid.uidByte[i] < 0x10) uid += '0'; uid += String(reader.uid.uidByte[i], HEX); }
      uid.toUpperCase(); lastCardSeen = now;
      if (uid != heldUid) { heldUid = uid; enqueue("rfid_scanned", uid.c_str()); }
      reader.PICC_HaltA(); reader.PCD_StopCrypto1();
    } else if (heldUid.length() && now - lastCardSeen > 450) { heldUid = ""; }
  }
  delay(5);
}
