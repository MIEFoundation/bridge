# MIEFoundation Bridge
[![Discord](https://img.shields.io/discord/494019390841421825?style=flat-square)](https://discord.gg/Hv9tJMf)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen?style=flat-square)](https://standardjs.com/)
[![License](https://img.shields.io/github/license/miefoundation/bridge?style=flat-square)](https://github.com/miefoundation/bridge/blob/master/LICENSE)

MIEFoundation Bridge - an [Node.js](https://nodejs.org) application that allows you to bridge chats from various platforms 💬

## Features
- Easy to use
- Extendable
- Supports:
- - VKontakte (user token only)
- - Discord
- - [TODO] Telegram
- - [TODO] Matrix
- - [TODO] IRC

## Installation
0. [Install Node.JS](https://nodejs.org/en/download/) **(latest LTS required)**

1. Clone this repo and install NPM dependencies.

```bash
npm install
```

2. Create `settings.js` with your configuration, see `settings.sample.js`

3. (Optional) Start this application on system reboot with [systemd](https://linuxconfig.org/how-to-create-systemd-service-unit-in-linux) or [cron](https://www.cyberciti.biz/faq/linux-execute-cron-job-after-system-reboot/)

## Usage
Start bridge using NPM with `npm start`

Or run directly `node app.js`

## Contributing
Pull requests are welcome.

For major changes, please [open an issue](https://github.com/MIEFoundation/bridge/issues/new) first 
to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)
