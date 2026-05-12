import base64
import json
import os
from pathlib import Path

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from flask import Flask, render_template, request, jsonify, send_file

app = Flask(__name__)

KEY_B64 = "21zTad0Pyq52CEsE26Ym8Mfp/S7lUfEyoJqsVZ6Y27w="
KEY = base64.b64decode(KEY_B64)

# Default save paths (mounted volume)
SAVE_DIR = os.environ.get(
    "SAVE_DIR",
    "/saves",
)

STATS_FILE = "DEMO_PlayerSavedStats.json"
STATS_BACKUP = "DEMO_PlayerSavedStats_BACKUP.json"
SETTINGS_FILE = "DEMO_PlayerSavedSettings.json"
SETTINGS_BACKUP = "DEMO_PlayerSavedSettings_BACKUP.json"
ACHIEVEMENTS_FILE = "achievements.dat"


def decrypt_save(data_b64: str) -> dict:
    ct = base64.b64decode(data_b64)
    iv = ct[:16]
    ciphertext = ct[16:]
    cipher = Cipher(algorithms.AES(KEY), modes.CBC(iv))
    dec = cipher.decryptor()
    pt_padded = dec.update(ciphertext) + dec.finalize()
    unpadder = padding.PKCS7(128).unpadder()
    pt = unpadder.update(pt_padded) + unpadder.finalize()
    return json.loads(pt.decode("utf-8"))


def encrypt_save(data: dict) -> str:
    pt = json.dumps(data, separators=(",", ":")).encode("utf-8")
    padder = padding.PKCS7(128).padder()
    pt_padded = padder.update(pt) + padder.finalize()
    iv = os.urandom(16)
    cipher = Cipher(algorithms.AES(KEY), modes.CBC(iv))
    enc = cipher.encryptor()
    ct = enc.update(pt_padded) + enc.finalize()
    return base64.b64encode(iv + ct).decode("ascii")


def read_save_file(filename: str) -> dict | None:
    path = Path(SAVE_DIR) / filename
    if not path.exists():
        return None
    return decrypt_save(path.read_text().strip())


def write_save_file(filename: str, data: dict):
    path = Path(SAVE_DIR) / filename
    encrypted = encrypt_save(data)
    path.write_text(encrypted)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/load", methods=["GET"])
def load_saves():
    result = {}
    for name, filename in [("stats", STATS_FILE), ("settings", SETTINGS_FILE)]:
        try:
            data = read_save_file(filename)
            if data is not None:
                result[name] = data
        except Exception as e:
            result[name + "_error"] = str(e)

    # Load achievements (plain CSV)
    ach_path = Path(SAVE_DIR) / ACHIEVEMENTS_FILE
    if ach_path.exists():
        result["achievements_raw"] = ach_path.read_text()

    result["save_dir"] = SAVE_DIR
    result["files_found"] = [
        f.name for f in Path(SAVE_DIR).iterdir() if f.is_file()
    ] if Path(SAVE_DIR).exists() else []

    return jsonify(result)


@app.route("/api/save", methods=["POST"])
def save_data():
    body = request.get_json()
    saved = []

    if "stats" in body:
        write_save_file(STATS_FILE, body["stats"])
        write_save_file(STATS_BACKUP, body["stats"])
        saved.append("stats")

    if "settings" in body:
        write_save_file(SETTINGS_FILE, body["settings"])
        write_save_file(SETTINGS_BACKUP, body["settings"])
        saved.append("settings")

    return jsonify({"ok": True, "saved": saved})


@app.route("/api/upload", methods=["POST"])
def upload_file():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    f = request.files["file"]
    content = f.read().decode("utf-8").strip()
    try:
        data = decrypt_save(content)
        return jsonify({"ok": True, "data": data, "filename": f.filename})
    except Exception as e:
        return jsonify({"error": f"Decryption failed: {e}"}), 400


@app.route("/api/download", methods=["POST"])
def download_encrypted():
    body = request.get_json()
    data = body.get("data")
    filename = body.get("filename", "save.json")
    if data is None:
        return jsonify({"error": "No data provided"}), 400
    encrypted = encrypt_save(data)
    return jsonify({"ok": True, "encrypted": encrypted, "filename": filename})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
