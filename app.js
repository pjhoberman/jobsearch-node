const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const jsdiff = require('diff');

const getUrls = async fn => {
    let urls = await fs.promises.readFile(fn, {encoding: 'utf-8'});
    urls = urls.split("\n");
    return urls;
};

async function getSavedData(url) {
    let data = await fs.promises.readFile('./jobs.json', {encoding: "utf-8"});
    data = JSON.parse(data);
    let text = data[url] || null;
    if (text) text = text.trim();
    return text;
}

let user_agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.47 Safari/537.36';
let headers = {'User-Agent': user_agent, "Content-Type": "text/html"};

const getSiteText = async (url) => {
    try {
        const result = await axios.get(url, {headers: headers});
        const $ = cheerio.load(result.data);
        return $.text().trim();
    }
    catch (err) {
        console.log(`Error on ${url}\n${err}`);
        return null;
    }
};

const updateData = async (json) => {
    let data = JSON.stringify(json);
    await fs.promises.writeFile('./jobs.json', data, {encoding: 'utf-8'});
};

global.new_json = {};
global.diff_count = 0;
const checkSite = async (url) => {
    let new_text = await getSiteText(url);
    let old_text = await getSavedData(url);
    new_json[url] = new_text;

    // compare
    if ((new_text && old_text) && (new_text !== old_text)) {
        diff_count++;
        let diff = jsdiff.diffTrimmedLines(old_text, new_text);
        let diff_report = `### ${url} ###`;
        diff.forEach((d) => {
            if (d.added) {
                diff_report += "\nAdded:\n";
                diff_report += d.value;
            } else if (d.removed) {
                diff_report += "\nRemoved:\n";
                diff_report += d.value;
            }
        });
        console.log(diff_report);
        return diff;
    }

    // save site_text to json
    return null;
};

async function checkSites() {
    const urls = await getUrls('./urls.txt');

    await Promise.all(urls.map(async (url) => {
        await checkSite(url);
    }));

    console.log("done checking sites.");
    console.log(`  total urls: ${urls.length}`);
    console.log(`  urls checked: ${Object.keys(new_json).length}`);
    console.log(`  total changed: ${diff_count}`);
    await updateData(new_json);
}

checkSites();