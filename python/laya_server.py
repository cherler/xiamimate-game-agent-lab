"""Local single-model adapter for the local game arena. Run with the pinned English checkpoint."""
import argparse
import hashlib
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock
from time import perf_counter
import importlib.metadata as metadata

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
import laya
import torch

REVISION = "85cc74ddae6109077ebe2853a9b3077fb6606a78"
WEIGHT_SHA = "891102d372688fc2a094dac56a384bc537b87c63f21f9f3dac0be2b7cbc8d86c"
parser = argparse.ArgumentParser()
parser.add_argument("--weights", default=".runtime/laya-english")
parser.add_argument("--port", type=int, default=4842)
parser.add_argument("--device", default=None)
args = parser.parse_args()
weights = Path(args.weights).resolve()
with (weights / "model.safetensors").open("rb") as weights_file:
    if hashlib.file_digest(weights_file, "sha256").hexdigest() != WEIGHT_SHA:
        raise RuntimeError("Laya weights do not match the pinned checkpoint")
torch.set_num_threads(min(4, os.cpu_count() or 1))
start = perf_counter()
agent = laya.load(str(weights), device=args.device)
agent.cfg["max_len"] = 1024
agent.cfg["head_max_len"] = 512
meta = {"model": "convaiinnovations/laya@" + REVISION, "revision": REVISION,
        "weight_sha256": WEIGHT_SHA, "device": str(agent.device),
        "sdk": metadata.version("laya"), "torch": torch.__version__,
        "transformers": metadata.version("transformers"),
        "load_ms": round(1000*(perf_counter()-start), 1)}
busy = Lock()

class Handler(BaseHTTPRequestHandler):
    def reply(self, status, data):
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        if self.path == "/health":
            self.reply(200, meta)
        else:
            self.reply(404, {"error": "unknown route"})

    def do_POST(self):
        if self.path != "/v1/systemone":
            self.reply(404, {"error": "unknown route"})
            return
        if self.headers.get("Origin") or self.headers.get_content_type() != "application/json":
            self.reply(403, {"error": "server-to-server JSON required"})
            return
        size = int(self.headers.get("Content-Length", 0))
        if not 0 < size <= 16000:
            self.reply(413, {"error": "wrong body size"})
            return
        if not busy.acquire(blocking=False):
            self.reply(503, {"error": "inference busy"})
            return
        try:
            data = json.loads(self.rfile.read(size))
            question = data["questions"]["move"]
            if question["type"] != "choice" or not 1 <= len(question["criteria"]) <= 8:
                raise ValueError("expected one bounded choice question")
            begin = perf_counter()
            prediction = agent.predict(data["state"], {"move": question})
            prediction["model"] = meta["model"]
            prediction["device"] = str(agent.device)
            prediction["inference_ms"] = round(1000*(perf_counter()-begin), 2)
            self.reply(200, prediction)
        except (KeyError, TypeError, ValueError) as exc:
            self.reply(400, {"error": type(exc).__name__})
        except Exception as exc:
            print("Inference error", type(exc).__name__, str(exc), flush=True)
            self.reply(500, {"error": "inference failed"})
        finally:
            busy.release()

    def log_message(self, fmt, *args):
        pass

print(json.dumps(meta), flush=True)
ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
