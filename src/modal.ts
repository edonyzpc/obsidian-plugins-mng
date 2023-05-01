import { App, Notice, SuggestModal } from 'obsidian'

interface Plugin {
    name: string;
    id: string;
    desc: string;
    enbaled: boolean;
}

export const OpenPlugin = true;
export const ClosePlugin = false;

export class PluginControlModal extends SuggestModal<Plugin> {
    private obsidianPlugins: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    private toEnablePlugin: boolean;

    constructor(app: App, toEnable: boolean) {
        super(app);
        this.obsidianPlugins = (app as any).plugins; // eslint-disable-line @typescript-eslint/no-explicit-any
        this.toEnablePlugin = toEnable;
    }

    // Returns all available suggestions.
    getSuggestions(query: string): Plugin[] {
        'use strict'
        const disabledPlugins: Plugin[] = [];
        const enabledPlugins: Plugin[] = [];
        for (const key of Object.keys((window.app as any).plugins.manifests)) { // eslint-disable-line @typescript-eslint/no-explicit-any
            // find disabled plugins
            if (!this.obsidianPlugins.enabledPlugins.has(this.obsidianPlugins.manifests[key].id)) {
                disabledPlugins.push({
                    name: this.obsidianPlugins.manifests[key].name,
                    id: this.obsidianPlugins.manifests[key].id,
                    desc: this.obsidianPlugins.manifests[key].description,
                    enbaled: false,
                });
            } else {
                enabledPlugins.push({
                    name: this.obsidianPlugins.manifests[key].name,
                    id: this.obsidianPlugins.manifests[key].id,
                    desc: this.obsidianPlugins.manifests[key].description,
                    enbaled: true,
                });
            }
        }
        return this.toEnablePlugin ? disabledPlugins.filter((plugin) => plugin.name.toLowerCase().includes(query.toLowerCase())) : enabledPlugins.filter((plugin) => plugin.name.toLowerCase().includes(query.toLowerCase()));
    }

    // Renders each suggestion item.
    renderSuggestion(plugin: Plugin, el: HTMLElement) {
        el.createEl("div", { text: plugin.name });
        el.createEl("small", { text: plugin.desc });
    }

    // Perform action on the selected suggestion.
    onChooseSuggestion(plugin: Plugin, evt: MouseEvent | KeyboardEvent) {
        'use strict'
        if (this.toEnablePlugin) {
            if (this.obsidianPlugins.enablePluginAndSave(plugin.id)) {
                new Notice(`enable plugin[${plugin.name}] successfully`);
            } else {
                new Notice(`enable plugin[${plugin.name}] failed, try it again`);
            }
        } else {
            if (this.obsidianPlugins.disablePluginAndSave(plugin.id)) {
                new Notice(`disable plugin[${plugin.name}] successfully`);
            } else {
                new Notice(`disable plugin[${plugin.name}] failed, try it again`);
            }
        }
    }
}