const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const jsdiff = require('diff');

const getUrls = async filepath => {
    let urls = await fs.promises.readFile(filepath, {encoding: 'utf-8'});
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

const user_agent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.47 Safari/537.36';
const headers = {'User-Agent': user_agent, "Content-Type": "text/html"};

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
    const data = JSON.stringify(json);
    await fs.promises.writeFile('./jobs.json', data, {encoding: 'utf-8'});
};

const checkSite = async (url) => {
    const new_text = await getSiteText(url);
    const old_text = await getSavedData(url);

    let site_info = {
        url: url,
        new_text: new_text,
        changed: false,
        added: null,
        removed: null,
    };

    // compare
    if ((new_text && old_text) && (new_text !== old_text)) {
        site_info.changed = true;

        const diff = jsdiff.diffTrimmedLines(old_text, new_text);

        site_info.added = diff.filter(d => d.added).map( d => d.value);
        site_info.removed = diff.filter(d => d.removed).map( d => d.value);
    }

    return site_info;
};

const log_results = (site) => {
    if( site.added || site.removed ) console.log(`### ${site.url} ###`);
    if (site.added) {
        console.log('Added:');
        site.added.forEach(a => console.log(a));
    }
    if (site.removed) {
        console.log('Removed:');
        site.removed.forEach(r => console.log(r));
    }
};

async function checkSites() {
    const urls = await getUrls('./urls.txt');

    let sites = await Promise.all(urls.map(async (url) => {
        return await checkSite(url);
    }));

    sites.forEach(log_results);

    const changed = sites.reduce( (c, site) => {return site.changed ? c + 1: c }, 0);

    // print stats
    console.log("done checking sites.");
    console.log(`  total urls: ${urls.length}`);
    console.log(`  urls checked: ${Object.keys(sites).length}`);
    console.log(`  total changed: ${changed}`);

    // save the new data
    let new_data = {};
    sites.map(site => new_data[site.url] = site.new_text)
    await updateData(new_data);
}

checkSites();
