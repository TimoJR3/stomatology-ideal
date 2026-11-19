# Свой сервер: установка и автодеплой

Схема: GitHub Actions собирает сайт, проверяет его и по SSH загружает на сервер в `/var/www/<сайт>/releases/<версия>`.
Затем ссылка `/var/www/<сайт>/current` мгновенно переключается на новую версию. nginx отдаёт `current`.
На одном сервере могут жить оба сайта (Ortodont Rashid и «Династия»): у каждого своя папка, свой конфиг и свой домен.

Команды ниже — для Ubuntu 24.04 LTS (у большинства хостингов есть такой образ). Выполнять под пользователем с `sudo`.

## 1. Базовая защита сервера (один раз на сервер)

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install nginx certbot ufw fail2ban unattended-upgrades rsync

# автоматические обновления безопасности
sudo dpkg-reconfigure -plow unattended-upgrades

# файрвол: только SSH, HTTP и HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# вход по SSH только по ключу, без пароля и без root
sudo sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/; s/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl reload ssh
```

Перед отключением паролей убедитесь, что сами входите по SSH-ключу, иначе потеряете доступ.

## 2. Пользователь для деплоя (один раз на сервер)

Отдельный пользователь без `sudo`: даже если ключ из GitHub утечёт, он даёт доступ только к папкам сайтов.

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo mkdir -p /var/www/letsencrypt
```

На своём компьютере создайте ключ только для деплоя (без пароля, он будет храниться в секретах GitHub):

```bash
ssh-keygen -t ed25519 -f deploy_key -C "github-actions-deploy" -N ""
```

Публичную часть (`deploy_key.pub`) добавьте на сервер:

```bash
sudo -u deploy mkdir -p /home/deploy/.ssh
sudo -u deploy tee -a /home/deploy/.ssh/authorized_keys < deploy_key.pub
sudo chmod 700 /home/deploy/.ssh && sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

## 3. Папка сайта и nginx (для каждого сайта)

Пример для «Династии» (`dinastiya`). Для Ortodont Rashid — то же самое с `ortodont-rashid`.

```bash
sudo mkdir -p /var/www/dinastiya/releases
sudo chown -R deploy:deploy /var/www/dinastiya

# конфиг из репозитория: deploy/nginx/site.conf и deploy/nginx/security-headers.conf
# в site.conf заменить dinastiya.example на свой домен
sudo cp security-headers.conf /etc/nginx/snippets/dinastiya-security-headers.conf
sudo cp site.conf /etc/nginx/sites-available/dinastiya.conf
```

Сертификат Let's Encrypt (домен уже должен указывать на IP сервера):

```bash
# временно включить только http-часть, чтобы получить сертификат
sudo certbot certonly --webroot -w /var/www/letsencrypt -d ВАШ-ДОМЕН -d www.ВАШ-ДОМЕН
sudo ln -s /etc/nginx/sites-available/dinastiya.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Если `certbot` ругается, что nginx не запускается без сертификата: закомментируйте блок `server { listen 443 … }`,
перезагрузите nginx, получите сертификат и верните блок. Сертификат продлевается автоматически (`systemctl list-timers | grep certbot`).

## 4. Секреты в GitHub (для каждого репозитория)

Settings → Secrets and variables → Actions:

| Тип | Имя | Что вписать |
|---|---|---|
| Secret | `DEPLOY_HOST` | IP или домен сервера |
| Secret | `DEPLOY_USER` | `deploy` |
| Secret | `DEPLOY_SSH_KEY` | содержимое файла `deploy_key` (приватный ключ) |
| Secret | `DEPLOY_KNOWN_HOSTS` | вывод команды `ssh-keyscan -t ed25519 IP-сервера` (отпечаток сервера, защищает от подмены) |
| Secret | `DEPLOY_PORT` | номер порта SSH, если не 22 (можно не создавать) |
| Variable | `SITE_URL` | `https://ВАШ-ДОМЕН` — после деплоя CI проверит живой сайт |

Отпечаток лучше снять прямо на сервере (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`) и сравнить с тем, что выдал `ssh-keyscan`.

После этого каждый push в `main` сам проверяет и выкладывает сайт. Файл `deploy_key` после настройки удалите с компьютера.

## 5. Откат на предыдущую версию

```bash
ssh deploy@СЕРВЕР
cd /var/www/dinastiya
ls -1t releases            # список версий, сверху новая
ln -sfn releases/ИМЯ-ПРЕДЫДУЩЕЙ current.tmp && mv -Tf current.tmp current
```

Или в GitHub: Actions → CI/CD → нужный старый запуск → Re-run jobs.

## Что защищает от нагрузки и атак

- **nginx `limit_req` / `limit_conn`:** один IP — до 20 запросов в секунду и 30 соединений. Лишнее получает ответ 429.
- **Только GET/HEAD**, тело запроса до 1 КБ, короткие тайм-ауты: сайту нечего принимать, поэтому всё остальное отклоняется.
- **Сжатие gzip и кэш на год** для шрифтов и библиотек: меньше трафика и нагрузки.
- **ufw, fail2ban** (подбор пароля SSH), вход только по ключу, автообновления безопасности.
- От крупной DDoS-атаки один сервер не спасёт. Если она понадобится, сайт ставят за Cloudflare (бесплатный тариф) — конфиг nginx для этого менять не нужно.
