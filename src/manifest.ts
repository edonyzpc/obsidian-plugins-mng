import { App, Notice, PluginManifest, normalizePath, request } from "obsidian";
import { gt } from "semver";

interface Manifest {
    id: string,
    version: string,
}

interface ObsidianManifest {
    items: Manifest[],
    URLCDN: string,
    getRepo(ID: string): Promise<string | null>,
    isNeedToUpdate(m: Manifest): Promise<boolean>,
    update(): Promise<void>,
}

interface PluginReleaseFiles {
    mainJs:     string | null;
    manifest:   string | null;
    styles:     string | null;
}

/*
interface ThemeReleaseFiles {
    manifest:   string | null;
    theme:     string | null;
}
*/

export class PluginsUpdater implements ObsidianManifest {
    /*
    private plugins: ObsidianManifest[];
    private PluginListURLCDN = `https://cdn.jsdelivr.net/gh/obsidianmd/obsidian-releases/community-plugins.json`;
    private themes: ObsidianManifest[];
    private ThemeListURLCDN = `https://cdn.jsdelivr.net/gh/obsidianmd/obsidian-releases/community-css-themes.json`;
    */

    items: Manifest[];
    URLCDN: string;
    private TagName = 'tag_name';
    app: App;

    constructor(app: App) {
        this.app = app;
        this.URLCDN = `https://cdn.jsdelivr.net/gh/obsidianmd/obsidian-releases/community-plugins.json`;
        this.items = [];
        for (const m of Object.values((app as any).plugins.manifests)) { // eslint-disable-line @typescript-eslint/no-explicit-any
            const i:Manifest = {
                id: (m as PluginManifest).id,
                version: (m as PluginManifest).version,
            };
            this.items.push(i);
        }
    }

    async getRepo(pluginID: string): Promise<string | null> {
        try {
            const response = await request({ url: this.URLCDN });
            const getPluginRepo = (r: string): string | null => {
                const lists = JSON.parse(r);
                for (let i = 0; i < lists.length; i++) {
                    const { id, repo } = lists[i];
                    if (id === pluginID) {
                        return repo;
                    }
                }
                return null;
            };
            return (response === "404: Not Found" ? null : getPluginRepo(response));
        } catch (error) {
            console.log("error in getPluginRepo", error)
            return null;
        }
    }

    private async getLatestRelease(repo: string | null): Promise<JSON | null> {
        if (!repo) {
            new Notice("repo is null");
            return null;
        }
        const URL = `https://api.github.com/repos/${repo}/releases/latest`;
        try {
            const response = await request({ url: URL });
            return (response === "404: Not Found" ? null : await JSON.parse(response));
        } catch (error) {
            if(error!="Error: Request failed, status 404")  { //normal error, ignore
                console.log(`error in grabManifestJsonFromRepository for ${URL}`, error);
            }
            return null;
        }
    }

    private getLatestTag(latest: JSON | null): string | null {
        if (!latest) {
            console.log("JSON is null");
            return null;
        }
        for (let index = 0; index < Object.getOwnPropertyNames(latest).length; index++) {
            if (this.TagName === Object.getOwnPropertyNames(latest)[index]) {
                return Object(latest)[this.TagName] as string;
            }
        }
        /*
        Object.getOwnPropertyNames(latest).forEach(key => {
            if (key === this.TagName) {
                console.log(key, Object(latest)[key]);
                return Object(latest)[key];
            }
        })
        */

        console.log("final return null");
        return null;
    }

    async isNeedToUpdate(m: Manifest): Promise<boolean> {
        const repo = await this.getRepo(m.id);
        if (repo) {
            new Notice("checking need to update for "+repo);
            const latestRelease = await this.getLatestRelease(repo);
            if (latestRelease) {
                let tag = this.getLatestTag(latestRelease);
                console.log("tag ==== ", tag);
                if (tag) {
                    new Notice("tag == " + tag);
                    if (tag.startsWith('v')) tag = tag.split('v')[1];
                    console.log("tag = " + tag, "current tag: " + m.version);
                    // /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)((-)(alpha|beta|rc)(\d+))?((\+)(\d+))?$/gm
                    if (gt(tag, m.version)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    async update(): Promise<void> {
        const getReleaseFile = async (repo: string | null, version: string | null, fileName: string) => {
            const URL = `https://github.com/${repo}/releases/download/${version}/${fileName}`;
            try {
                const download = await request({ url: URL });
                return ((download === "Not Found" || download === `{"error":"Not Found"}`) ? null : download);
            } catch (error) {
                console.log("error in grabReleaseFileFromRepository", URL, error)
                return null;
            }
        };
        const writeToPluginFolder = async (pluginID: string, files: PluginReleaseFiles): Promise<void> => {
            const pluginTargetFolderPath = normalizePath(this.app.vault.configDir + "/plugins/" + pluginID) + "/";
            const adapter = this.app.vault.adapter;
            if (!files.mainJs || !files.manifest) {
                console.log("downloaded files are empty");
                return;
            }
            if (await adapter.exists(pluginTargetFolderPath) === false ||
                !(await adapter.exists(pluginTargetFolderPath + "manifest.json"))) {
                // if plugin folder doesnt exist or manifest.json doesn't exist, create it and save the plugin files
                await adapter.mkdir(pluginTargetFolderPath);
            }
            await adapter.write(pluginTargetFolderPath + "main.js", files.mainJs);
            await adapter.write(pluginTargetFolderPath + "manifest.json", files.manifest);
            if (files.styles) await adapter.write(pluginTargetFolderPath + "styles.css", files.styles);
        };

        this.items.forEach(async (plugin) => {
            new Notice("start to update " + plugin.id);
            const repo = await this.getRepo(plugin.id);
            const latestRlease = await this.getLatestRelease(repo);
            const tag = getLatestTag(latestRlease);
            const need2Update = await this.isNeedToUpdate(plugin);
            console.log(repo + " need to update: ", need2Update);
            if (need2Update) {
                new Notice("updateing plugin " + plugin.id, 10);
                const releases:PluginReleaseFiles = {
                    mainJs:null,
                    manifest:null,
                    styles:null,
                }
                releases.mainJs = await getReleaseFile(repo, tag, 'main.js');
                releases.manifest = await getReleaseFile(repo, tag, 'manifest.json');
                releases.mainJs = await getReleaseFile(repo, tag, 'styles.css');
                await writeToPluginFolder(plugin.id, releases);
            }
        })
    }
}

export class ThemeUpdater implements ObsidianManifest {
    items: Manifest[];
    URLCDN: string;
    app: App;

    public async init(app: App): Promise<ThemeUpdater> {
        const themeUpdater = new ThemeUpdater(app);
        themeUpdater.items = await listThemes(this.app);
        return themeUpdater;
    }

    private constructor(app: App) {
        this.app = app;
        this.URLCDN = `https://cdn.jsdelivr.net/gh/obsidianmd/obsidian-releases/community-css-themes.json`;
    }

    async getRepo(pluginID: string): Promise<string | null> {
        return null;
    }

    async isNeedToUpdate(m: Manifest): Promise<boolean> {
        return false;
    }

    async update(): Promise<void> {
        return;
    }
}

// list obsidian themes
async function listThemes(app: App): Promise<Manifest[]> {
    const themes:Manifest[] = [];
    const themeDirs = await app.vault.adapter.list(app.vault.configDir + '/themes');
    themeDirs.folders.forEach(async (f) => {
        const themeFile = normalizePath(f + '/manifest.json');
        const m = await app.vault.adapter.read(themeFile);
        const object = JSON.parse(m);
        themes.push({
            id: object.name,
            version: object.version,
        });
    })
    return themes;
}

// get all of the plugins whose manifests can be parsed
export function getPluginManifests(app: App): PluginManifest[] {
    const pluginManiftests:PluginManifest[] = [];
    for (const m of Object.values((app as any).plugins.manifests)) { // eslint-disable-line @typescript-eslint/no-explicit-any
        pluginManiftests.push(m as PluginManifest);
    }

    return pluginManiftests;
}

// get the latest release object from github
export async function graLatestRelease(repo: string | null): Promise<JSON | null> {
    if (!repo) return null;
    const URL = `https://api.github.com/repos/${repo}/releases/latest`;
    try {
        const response = await request({ url: URL });
        return (response === "404: Not Found" ? null : await JSON.parse(response));
    } catch (error) {
        if(error!="Error: Request failed, status 404")  { //normal error, ignore
            console.log(`error in grabManifestJsonFromRepository for ${URL}`, error);
        }
        return null;
    }
}

// get the latest tag from the latest release object
export function getLatestTag(latest: JSON | null): string | null {
    if (!latest) return null;
    Object.getOwnPropertyNames(latest).forEach(key => {
        if (key === 'tag_name') return  Object(latest)[key];
    })
    return null;
}

export async function getPluginRepo(ID: string): Promise<string|null> {
    // if use raw.githubcontent.com to download, timeout will occur frequently
    //const pluginListURL = `https://raw.githubusercontent.com/obsidianmd/obsidian-releases/HEAD/community-plugins.json`;
    const pluginListURLCDN = `https://cdn.jsdelivr.net/gh/obsidianmd/obsidian-releases/community-plugins.json`;
    try {
        const response = await request({ url: pluginListURLCDN });
        const getRepo = (r:string): string|null => {
            const lists = JSON.parse(r);
            for (let i = 0; i < lists.length; i++) {
                const { id, repo } = lists[i];
                if (id === ID) {
                    return repo;
                }
            }
            return null;
        }
        return (response === "404: Not Found" ? null : getRepo(response));
    } catch (error) {
        console.log("error in getPluginRepo", error)
        return null;
    }
}

export async function isNeedToUpdate(m: PluginManifest): Promise<boolean> {
    const repo = await getPluginRepo(m.id);
    if (repo) {
        const latestRelease = await graLatestRelease(repo);
        if (latestRelease) {
            let tag = getLatestTag(latestRelease);
            if (tag) {
                if (tag.startsWith('v')) tag = tag.split('v')[1];
                if (tag > m.version) {
                    return true;
                }
            }
        }
    }

    return false;
}

export async function getReleaseFile(repo:string|null, version:string|null, fileName:string) {
    const URL = `https://github.com/${repo}/releases/download/${version}/${fileName}`;
    try {
        const download = await request({ url: URL });
        return ((download === "Not Found" || download === `{"error":"Not Found"}`) ? null : download);
    } catch (error) {
        console.log("error in grabReleaseFileFromRepository", URL, error)
        return null;
    }
}

export async function writeReleaseFilesToPluginFolder(pluginID: string, files: PluginReleaseFiles): Promise<void> {
    const pluginTargetFolderPath = normalizePath(this.plugin.app.vault.configDir + "/plugins/" + pluginID) + "/";
    const adapter = this.plugin.app.vault.adapter;
    if (await adapter.exists(pluginTargetFolderPath) === false ||
        !(await adapter.exists(pluginTargetFolderPath + "manifest.json"))) {
        // if plugin folder doesnt exist or manifest.json doesn't exist, create it and save the plugin files
        await adapter.mkdir(pluginTargetFolderPath);
    }
    await adapter.write(pluginTargetFolderPath + "main.js", files.mainJs);
    await adapter.write(pluginTargetFolderPath + "manifest.json", files.manifest);
    if (files.styles) await adapter.write(pluginTargetFolderPath + "styles.css", files.styles);
}

export async function updatePlugins(app:App) {
    const plugins = getPluginManifests(app);
    plugins.forEach(async (plugin) => {
        const repo = await getPluginRepo(plugin.id);
        const latestRlease = await graLatestRelease(repo);
        const tag = getLatestTag(latestRlease);
        if (await isNeedToUpdate(plugin)) {
            const releases:PluginReleaseFiles = {
                mainJs:null,
                manifest:null,
                styles:null,
            }
            releases.mainJs = await getReleaseFile(repo, tag, 'main.js');
            releases.manifest = await getReleaseFile(repo, tag, 'manifest.json');
            releases.mainJs = await getReleaseFile(repo, tag, 'styles.css');
            await writeReleaseFilesToPluginFolder(plugin.id, releases);
        }
    })
}