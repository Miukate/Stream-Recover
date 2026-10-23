# 🎥 Stream Recorder

Chrome/Edge extension: allows recording live streams from Twitch and Kick directly to your hard drive, bypassing RAM overflow, with automatic video remuxing.

## Features

* 📺 Support for two platforms: Twitch and Kick
* 💾 Direct-to-disk recording (does not overflow RAM, can record for hours)
* ⚡ HLS stream interception (extracts all available qualities, including Source)
* 🎬 Automatic remuxing (repackaging to `.mp4` on the fly without quality loss)
* 🎨 Neon design: purple theme for Twitch and green for Kick
* 🌍 Two language support (RU / EN)
* ⌨️ Hotkeys for quick start and stop of recording

## Installation

1. Download or clone the repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the project folder.
5. On first launch, select the folder where recordings will be saved.
6. **Important:** Make sure the `mux.min.js` file is in the project folder (it is required for video conversion).

## Usage

1. Open a stream tab on Twitch or Kick.
2. Click on the extension icon.
3. Select the desired stream tab and video quality.
4. Click **START** (or the red dot button to record until the end of the stream).
5. Recording will start in the background, and the extension icon will change to red with a `REC` badge.

## License

MIT


# 🎥 Stream Recorder

Расширение для Chrome/Edge: позволяет записывать прямые трансляции с Twitch и Kick напрямую на жесткий диск, минуя переполнение оперативной памяти, с автоматическим ремуксом видео.

## Возможности

* 📺 Поддержка двух платформ: Twitch и Kick
* 💾 Прямая запись на диск (не переполняет ОЗУ, можно писать часами)
* ⚡ Перехват HLS-потоков (достает все доступные качества, включая Source)
* 🎬 Автоматический ремукс (перепаковка в `.mp4` на лету без потери качества)
* 🎨 Неоновый дизайн: фиолетовая тема для Twitch и зеленая для Kick
* 🌍 Поддержка двух языков (RU / EN)
* ⌨️ Горячие клавиши для быстрого старта и остановки записи

## Установка

1. Скачай или клонируй репозиторий.
2. Открой `chrome://extensions` (или `edge://extensions`).
3. Включи **Режим разработчика** (справа вверху).
4. Нажми **Загрузить распакованное расширение** и выбери папку проекта.
5. При первом запуске выбери папку, куда будут сохраняться записи.
6. **Важно:** Убедись, что в папке с проектом лежит файл `mux.min.js` (он нужен для конвертации видео).

## Использование

1. Открой вкладку со стримом на Twitch или Kick.
2. Кликни на иконку расширения.
3. Выбери нужную вкладку со стримом и качество видео.
4. Нажми **СТАРТ** (или кнопку с красной точкой для записи до конца стрима).
5. Запись начнется в фоне, а иконка расширения сменится на красную с меткой `REC`.

## Лицензия

MIT
