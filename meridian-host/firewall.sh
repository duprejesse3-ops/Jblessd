#!/usr/bin/env bash
# Default-deny firewall for a shop host. 22 / 80 / 443 only.
set -euo pipefail
if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash firewall.sh"
  exit 1
fi
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ufw fail2ban

ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

cat >/etc/fail2ban/jail.d/multinicheai.conf <<'JAIL'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
findtime = 10m
JAIL
systemctl enable --now fail2ban
systemctl restart fail2ban || true

echo "Firewall on. Incoming allowed: 22, 80, 443. Fail2ban watching SSH."
