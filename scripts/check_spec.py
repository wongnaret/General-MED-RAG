#!/usr/bin/env python3
import os
import sys
import platform
import subprocess
import shutil

def print_banner():
    print("=" * 60)
    print("      GENERAL-MED-RAG: ON-PREMISES SYSTEM SPEC CHECKER      ")
    print("=" * 60)

def check_os():
    system = platform.system()
    release = platform.release()
    print(f"[*] Checking Operating System... {system} ({release})")
    
    if system.lower() == "linux":
        print("  [PASS] Operating system is Linux.")
        return True
    elif "microsoft" in release.lower():
        print("  [PASS] Operating system is Windows WSL (Linux-like environment).")
        return True
    else:
        print("  [WARNING] Non-Linux environment detected. On-prem production setup is optimized for Linux.")
        return False

def check_cpu():
    cores = os.cpu_count() or 0
    print(f"[*] Checking CPU Cores... {cores} cores detected")
    if cores >= 16:
        print("  [PASS] Recommended spec met (>= 16 cores).")
    elif cores >= 8:
        print("  [PASS] Minimum spec met (>= 8 cores).")
    elif cores >= 4:
        print("  [WARNING] Low CPU core count. Local LLMs may run slowly.")
    else:
        print("  [FAIL] Critical: CPU cores count is too low (< 4 cores).")

def check_ram():
    print("[*] Checking System RAM...")
    total_gb = 0.0
    
    # Try reading from /proc/meminfo first (Linux/WSL native)
    if os.path.exists("/proc/meminfo"):
        try:
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if "MemTotal" in line:
                        parts = line.split()
                        # MemTotal is usually in kB
                        kb = float(parts[1])
                        total_gb = kb / (1024 * 1024)
                        break
        except Exception:
            pass
            
    # Fallback to psutil if available
    if total_gb == 0.0:
        try:
            import psutil
            total_gb = psutil.virtual_memory().total / (1024 ** 3)
        except ImportError:
            # Fallback on Windows if someone runs it there
            if platform.system().lower() == "windows":
                try:
                    # Run systeminfo or wmic
                    out = subprocess.check_output("wmic ComputerSystem get TotalPhysicalMemory", shell=True)
                    total_bytes = int(out.decode().split("\n")[1].strip())
                    total_gb = total_bytes / (1024 ** 3)
                except Exception:
                    pass

    if total_gb > 0.0:
        print(f"  Total RAM: {total_gb:.2f} GB")
        if total_gb >= 64:
            print("  [PASS] Recommended RAM spec met (>= 64 GB).")
        elif total_gb >= 32:
            print("  [PASS] Minimum RAM spec met (>= 32 GB).")
        elif total_gb >= 16:
            print("  [WARNING] Only 16GB RAM detected. Recommended for API models only. Local LLMs may struggle.")
        else:
            print("  [FAIL] RAM too low (< 16 GB). Running local models is not recommended.")
    else:
        print("  [WARNING] Could not determine total RAM size automatically.")

def check_gpu():
    print("[*] Checking for NVIDIA GPU / CUDA capability...")
    nvidia_smi = shutil.which("nvidia-smi")
    if not nvidia_smi:
        print("  [WARNING] nvidia-smi not found. Running local models will fallback to CPU-only execution.")
        return
        
    try:
        # Run nvidia-smi to query GPUs
        out = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            universal_newlines=True
        )
        lines = out.strip().split("\n")
        print(f"  Detected {len(lines)} NVIDIA GPU(s):")
        for i, line in enumerate(lines):
            name, vram = line.split(",")
            vram_gb = float(vram.strip()) / 1024.0
            print(f"    - GPU {i}: {name.strip()} ({vram_gb:.2f} GB VRAM)")
            
            if vram_gb >= 24:
                print("      [PASS] Perfect for serving local model (>= 24GB VRAM).")
            elif vram_gb >= 12:
                print("      [PASS] Medium spec (>= 12GB VRAM). Good for quantized models (e.g., Qwen-7B Q4_K_M).")
            else:
                print("      [WARNING] Low VRAM (< 12GB). You will need heavily quantized models or CPU offloading.")
    except Exception as e:
        print(f"  [WARNING] nvidia-smi found but failed to query GPU details: {e}")

def check_docker():
    print("[*] Checking Docker and Docker-Compose installation...")
    docker_bin = shutil.which("docker")
    docker_compose_bin = shutil.which("docker-compose") or shutil.which("docker")
    
    if docker_bin:
        try:
            ver = subprocess.check_output(["docker", "--version"], universal_newlines=True).strip()
            print(f"  [PASS] Docker found: {ver}")
        except Exception:
            print("  [WARNING] Docker binary exists but failed to execute.")
    else:
        print("  [FAIL] Docker is NOT installed. Docker is required to host Neo4j and Qdrant database servers.")
        
    if docker_bin:
        # Check docker compose as plugin (docker compose) or standalone (docker-compose)
        try:
            ver = subprocess.check_output(["docker", "compose", "version"], universal_newlines=True).strip()
            print(f"  [PASS] Docker Compose (v2 Plugin) found: {ver}")
        except Exception:
            if docker_compose_bin:
                try:
                    ver = subprocess.check_output(["docker-compose", "--version"], universal_newlines=True).strip()
                    print(f"  [PASS] Docker Compose (v1 Standalone) found: {ver}")
                except Exception:
                    print("  [FAIL] Docker Compose not found. Please install the Docker Compose plugin.")
            else:
                print("  [FAIL] Docker Compose not found. Please install the Docker Compose plugin.")

def main():
    print_banner()
    os_ok = check_os()
    check_cpu()
    check_ram()
    check_gpu()
    check_docker()
    print("=" * 60)
    print("[*] Check completed. Please review the PASS, WARNING, and FAIL items above.")
    print("=" * 60)

if __name__ == "__main__":
    main()
