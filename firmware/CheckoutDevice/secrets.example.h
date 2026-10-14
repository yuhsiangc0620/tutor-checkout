#pragma once
// Copy this file to secrets.h. Do not commit secrets.h.
const char* WIFI_SSID = "YOUR_2_4_GHZ_WIFI";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* EVENT_URL = "https://YOUR_STABLE_DEPLOYMENT.vercel.app/api/device/events";
const char* DEVICE_ID = "checkout-01";
const char* DEVICE_TOKEN = "MATCH_VERCEL_DEVICE_TOKEN";
// For a protected Vercel preview: enter its Protection Bypass for Automation secret.
// Leave empty only if this deployment can be reached without Vercel login.
const char* VERCEL_BYPASS = "";
