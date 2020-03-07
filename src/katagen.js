#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { EOL } = require('os');

const inquirer = require('inquirer');
const fetch = require('node-fetch');

const extensions = require('./langs');

const configPath = path.join(process.cwd(), 'katagen.json');
const API_URL = 'https://www.codewars.com/api/v1/code-challenges/';

async function buildConfig() {
  let config = null;
  if (fs.existsSync(path.join(process.cwd(), 'katagen.json'))) {
    config = JSON.parse(fs.readFileSync(configPath), 'utf8');
  } else {
    const answers = await inquirer.prompt([{
      type: 'text',
      name: 'prefix',
      message: 'What prefix do you want to use for day directories?',
      default: 'day_',
    }, {
      type: 'list',
      name: 'lang',
      message: 'Select your preffered language to code',
      choices: Object.keys(extensions),
    }, {
      type: 'confirm',
      name: 'tok',
      message: 'Do you want a \'Table of Katas\' in main README?',
      default: true,
    },
    ]);
    config = { ...answers, katas: {} };
    // TODO: check for existing day directories
  }
  return config;
}

function generateNewDay(latestDayPath) {
  fs.mkdirSync(latestDayPath);
  const date = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const header = `# ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  fs.writeFileSync(path.join(latestDayPath, 'README.md'), header, 'utf8');
}

buildConfig()
  .then(async (config) => {
    const { kataLink } = await inquirer.prompt([{
      type: 'input',
      name: 'kataLink',
      message: 'Enter your new kata\'s link',
      default: '',
      validate: (link) => (link === '' || link.startsWith('https://www.codewars.com/kata/') ? true : 'Please provide a kata link from Codewars or leave empty to skip'),
    }]);

    const days = fs.readdirSync(process.cwd())
      .filter((dir) => dir.startsWith(config.prefix))
      .map((day) => Number.parseInt(day.slice(config.prefix.length), 10));

    if (kataLink !== '') {
      const apiSuffix = kataLink.slice(30).split('/')[0];
      const res = await fetch(`${API_URL}${apiSuffix}`);
      const kata = (res.ok) ? await res.json() : null;
      if (kata) {
        const { slug, url, rank: { name: kyu } } = kata;
        if (!Object.prototype.hasOwnProperty.call(config.katas, slug)) {
          const { lang } = await inquirer.prompt([{
            type: 'list',
            name: 'lang',
            message: 'Select your preffered language to code for this kata',
            choices: kata.languages,
            default: config.lang,
          }]);
          // check if latest day's latest kata was created before today
          let latestDay = days.reduce((x, y) => Math.max(x, y), 0);
          let latestDayPath = path.join(process.cwd(), `${config.prefix}${latestDay.toString().padStart(2, '0')}`);
          if (!fs.existsSync(latestDayPath)) {
            generateNewDay(latestDayPath);
            days.push(latestDay);
          }
          const latestDayTimes = fs.readdirSync(latestDayPath)
            .slice(1)
            .map((kataFile) => fs.statSync(path.join(latestDayPath, kataFile)).ctimeMs);
          const lastTime = Math.max(...latestDayTimes);

          const nextDay = new Date(lastTime + 86400000);
          nextDay.setHours(0, 0, 0, 0);
          if (new Date().getTime() > nextDay.getTime()) {
            // new day
            latestDay += 1;
            latestDayPath = path.join(process.cwd(), `${config.prefix}${latestDay.toString().padStart(2, '0')}`);
            generateNewDay(latestDayPath);
            days.push(latestDay);
          }
          fs.writeFileSync(path.join(latestDayPath, `${slug}${extensions[lang]}`), 'you got this!', 'utf8');
          Object.assign(config, { katas: { ...config.katas, [`${slug}`]: extensions[lang] } });

          // modify day's readme
          // TODO: maybe re-generate day's readme just in case it does not exist
          let readme = fs.readFileSync(path.join(latestDayPath, 'README.md'), 'utf-8');
          const readmeKyus = readme.match(/\d\skyu/g);
          const kyuList = (readmeKyus === null) ? [`${kyu}`] : readmeKyus.map((k) => Number.parseInt(k.replace(' kyu', ''), 10));
          const kataKyu = Number.parseInt(kyu.replace(' kyu', ''), 10);
          const kyuText = `# ${kyu}${EOL}${EOL}* [${slug}](${url})`;

          if (kyuList.includes(kataKyu)) {
            readme = readme.replace(`# ${kyu}${EOL}`, kyuText);
          } else {
            const append = kyuList.filter((k) => kataKyu > k);
            readme = (append.length === 0) ? `${readme}${EOL}${EOL}${kyuText}` : readme.replace(`# ${append[0]} kyu`, `${kyuText}${EOL}${EOL}# ${append[0]} kyu`);
          }
          fs.writeFileSync(path.join(latestDayPath, 'README.md'), readme, 'utf8');
        } else {
          console.warn('you have already solved this kata, please pick a new one!');
        }
      } else {
        console.error('could not get a response from codewars api, only generating readme...');
      }
    }

    // generate readme
    let readme = `# what's this?${EOL}this repo contains solutions to various katas from codewars.${EOL}${EOL}kata links can be found in each day's readme.${EOL}${EOL}`;
    if (config.tok) {
      readme += `# table of katas${EOL}${EOL}`;

      days.forEach((day) => {
        const dayName = `${config.prefix}${day.toString().padStart(2, '0')}`;
        const dayReadme = fs.readFileSync(path.join(process.cwd(), dayName, 'README.md'), 'utf-8');

        readme += `### [${dayName}](./${dayName})${EOL}|`;
        const kyus = dayReadme.match(/\d\skyu/g);
        kyus.forEach((kyu) => {
          readme += ` ${kyu} |`;
        });
        readme += `${EOL}|`;
        kyus.forEach(() => {
          readme += ':-----:|';
        });
        readme += `${EOL}`;

        const sections = dayReadme
          .split(/\n#\s/g)
          .splice(1)
          .map((s) => s.match(/\*\s.*/g).map((k) => k.slice(2)));
        const max = Math.max(...sections.map((s) => s.length));

        for (let i = 0; i < max; i += 1) {
          // eslint-disable-next-line no-loop-func
          sections.forEach((section) => {
            const kata = section.shift();
            if (kata) {
              const slug = kata.match(/\[.*\]/g)[0].slice(1, -1);
              const link = kata.match(/\(.*\)/g)[0].slice(1, -1).replace(/(.*)*/, `./${dayName}/${slug}${config.katas[slug]}`);
              readme += `|[${slug}](${link})`;
            } else {
              readme += '|';
            }
          });
          readme += '|\n';
        }
        readme += EOL;
      });

      fs.writeFileSync(path.join(process.cwd(), 'README.md'), readme, 'utf8');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    }
    console.log('all done! 🎉');
  });
