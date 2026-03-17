(function () {
    var webhookURL = window.webhookURL || 'COLOCA_AQUI_O_TEU_WEBHOOK_DISCORD';
    var SCRIPT_NS = 'defesa_disponivel_bot_compat';
    var DIALOG_ID = 'defesa_disponivel_dialog';

    try { $(document).off('.' + SCRIPT_NS); } catch (e) {}
    try { Dialog.close(); } catch (e) {}
    try { delete window.villagesTroopsCounter; } catch (e) { window.villagesTroopsCounter = undefined; }

    class VillagesTroopsCounter {
        static translations() {
            return {
                en_US: {
                    title: 'Home and Scavenging Troops Counter',
                    subtitle: 'Defense summary and offensive village status',
                    home: 'Home',
                    scavenging: 'Scavenging',
                    total: 'Total',
                    defensiveTotal: 'Total Defensive Troops',
                    group: 'Current group',
                    player: 'Player',
                    server: 'Server',
                    refresh: 'Refresh',
                    sendDiscord: 'Send to Discord',
                    nukeStatus: 'Offensive Status (Villages)',
                    full: 'Fulls',
                    semi: 'Semis',
                    rebuilding: 'Rebuilding',
                    noGroup: 'All',
                    errorMessages: {
                        premiumRequired: 'Error. A premium account is required to run this script!',
                        errorFetching: 'An error occurred while trying to fetch the following URL:',
                        missingSavengeMassScreenElement: 'Could not locate ScavengeMassScreen in the mass scavenging page.',
                        invalidWebhook: 'Invalid or missing Discord webhook.',
                        troopsReadError: 'Could not read troop data.',
                        invalidWorldConfig: 'Invalid world configuration.'
                    },
                    successMessage: 'Loaded successfully!',
                    loadingMessage: 'Loading...',
                    loadingWorldConfigMessage: 'Loading world config...',
                    discordSuccess: 'Sent to Discord successfully!',
                    discordError: 'Error sending data to Discord.',
                    credits: 'Defesa Disponível by JDi4s'
                },
                pt_PT: {
                    title: 'Contador de tropas em casa e em buscas',
                    subtitle: 'Resumo defensivo e estado ofensivo das aldeias',
                    home: 'Em casa',
                    scavenging: 'Em busca',
                    total: 'Total',
                    defensiveTotal: 'Tropa Defensiva Total',
                    group: 'Grupo atual',
                    player: 'Jogador',
                    server: 'Servidor',
                    refresh: 'Atualizar',
                    sendDiscord: 'Enviar para Discord',
                    nukeStatus: 'Estado de Ataque (Aldeias)',
                    full: 'Fulls',
                    semi: 'Semis',
                    rebuilding: 'A recrutar',
                    noGroup: 'Todos',
                    errorMessages: {
                        premiumRequired: 'Erro. É necessário possuir conta premium para correr este script!',
                        errorFetching: 'Ocorreu um erro ao tentar carregar o seguinte URL:',
                        missingSavengeMassScreenElement: 'Ocorreu um erro ao tentar localizar o elemento ScavengeMassScreen dentro da página de buscas em massa.',
                        invalidWebhook: 'Webhook do Discord inválido ou não definido.',
                        troopsReadError: 'Não foi possível ler os dados das tropas.',
                        invalidWorldConfig: 'Configuração do mundo inválida.'
                    },
                    successMessage: 'Carregado com sucesso!',
                    loadingMessage: 'A carregar...',
                    loadingWorldConfigMessage: 'A carregar configurações do mundo...',
                    discordSuccess: 'Enviado para o Discord com sucesso!',
                    discordError: 'Erro ao enviar dados para o Discord.',
                    credits: 'Defesa Disponível by JDi4s'
                }
            };
        }

        constructor() {
            const allTranslations = VillagesTroopsCounter.translations();
            this.UserTranslation = allTranslations[game_data.locale] || allTranslations.en_US;

            this.availableUnits = Array.isArray(game_data.units) ? [...game_data.units] : [];
            const militiaIndex = this.availableUnits.indexOf('militia');
            if (militiaIndex !== -1) this.availableUnits.splice(militiaIndex, 1);

            this.worldConfig = null;
            this.isScavengingWorld = false;
            this.worldConfigFileName = `worldConfigFile_${game_data.world}`;
            this.lastTroopsObj = null;
        }

        async init() {
            if (!game_data.features.Premium.active) {
                UI.ErrorMessage(this.UserTranslation.errorMessages.premiumRequired);
                return;
            }

            await this.#initWorldConfig();
            await this.#createUI();
        }

        async #initWorldConfig() {
            let worldConfig = localStorage.getItem(this.worldConfigFileName);

            if (worldConfig === null) {
                UI.InfoMessage(this.UserTranslation.loadingWorldConfigMessage);
                worldConfig = await this.#getWorldConfig();
            }

            this.worldConfig = typeof worldConfig === 'string' ? $.parseXML(worldConfig) : worldConfig;

            try {
                this.isScavengingWorld =
                    this.worldConfig
                        .getElementsByTagName('config')[0]
                        .getElementsByTagName('game')[0]
                        .getElementsByTagName('scavenging')[0]
                        .textContent.trim() === '1';
            } catch (e) {
                UI.ErrorMessage(this.UserTranslation.errorMessages.invalidWorldConfig);
                throw e;
            }
        }

        async #getWorldConfig() {
            const xml = this.#fetchHtmlPage('/interface.php?func=get_config');
            const xmlString = typeof xml === 'string'
                ? xml
                : new XMLSerializer().serializeToString(xml);

            localStorage.setItem(this.worldConfigFileName, xmlString);
            await this.#waitMilliseconds(Date.now(), 200);
            return xmlString;
        }

        async #waitMilliseconds(lastRunTime, milliseconds = 0) {
            await new Promise(res => {
                setTimeout(res, Math.max((lastRunTime || 0) + milliseconds - Date.now(), 0));
            });
        }

        #generateUrl(screen, mode = null, extraParams = {}) {
            let url = `/game.php?village=${game_data.village.id}&screen=${screen}`;
            if (mode !== null) url += `&mode=${mode}`;

            $.each(extraParams, function (key, value) {
                url += `&${key}=${value}`;
            });

            if (game_data.player.sitter !== "0") url += "&t=" + game_data.player.id;
            return url;
        }

        #initTroops() {
            const troops = {};
            this.availableUnits.forEach(function (unit) {
                troops[unit] = 0;
            });
            return troops;
        }

        #fetchHtmlPage(url) {
            let tempData = null;
            const self = this;

            $.ajax({
                async: false,
                url: url,
                type: 'GET',
                success: function (data) {
                    tempData = data;
                },
                error: function () {
                    UI.ErrorMessage(`${self.UserTranslation.errorMessages.errorFetching} ${url}`);
                }
            });

            return tempData;
        }

        async #getTroopsScavengingWorldObj() {
            const troopsObj = {
                villagesTroops: this.#initTroops(),
                scavengingTroops: this.#initTroops()
            };

            let currentPage = 0;
            let lastRunTime = null;

            do {
                const scavengingObject = await getScavengeMassScreenJson(this, currentPage, lastRunTime);
                if (!scavengingObject) return troopsObj;
                if (scavengingObject.length === 0) break;

                lastRunTime = Date.now();

                $.each(scavengingObject, function (id, villageData) {
                    $.each(villageData.unit_counts_home || {}, function (key, value) {
                        if (key !== 'militia' && typeof troopsObj.villagesTroops[key] !== 'undefined') {
                            troopsObj.villagesTroops[key] += value;
                        }
                    });

                    $.each(villageData.options || [], function (id, option) {
                        if (option.scavenging_squad !== null) {
                            $.each(option.scavenging_squad.unit_counts || {}, function (key, value) {
                                if (key !== 'militia' && typeof troopsObj.scavengingTroops[key] !== 'undefined') {
                                    troopsObj.scavengingTroops[key] += value;
                                }
                            });
                        }
                    });
                });

                currentPage++;
            } while (true);

            return troopsObj;

            async function getScavengeMassScreenJson(currentObj, currentPage = 0, lastRunTime = 0) {
                await currentObj.#waitMilliseconds(lastRunTime, 200);
                const html = currentObj.#fetchHtmlPage(
                    currentObj.#generateUrl('place', 'scavenge_mass', { page: currentPage })
                );

                if (!html) return false;

                const matches = html.match(/ScavengeMassScreen[\s\S]*?(,\n *\[.*?\}{0,3}\],\n)/);
                if (!matches || matches.length <= 1) {
                    UI.ErrorMessage(currentObj.UserTranslation.errorMessages.missingSavengeMassScreenElement);
                    return false;
                }

                let json = matches[1];
                json = json.substring(json.indexOf('['));
                json = json.substring(0, json.length - 2);

                try {
                    return JSON.parse(json);
                } catch (e) {
                    return false;
                }
            }
        }

        async #getTroopsNonScavengingWorldObj() {
            const troopsObj = {
                villagesTroops: this.#initTroops(),
                scavengingTroops: this.#initTroops()
            };

            let currentPage = 0;
            let lastRunTime = Date.now();

            await this.#setMaxLinesPerPage('overview_villages', 'units', 1000);
            await this.#waitMilliseconds(lastRunTime, 200);

            let lastVillageId = null;

            do {
                lastRunTime = Date.now();

                const rawPage = this.#fetchHtmlPage(
                    this.#generateUrl('overview_villages', 'units', { page: currentPage })
                );
                if (!rawPage) break;

                const overviewTroopsPage = $.parseHTML(rawPage);
                const troopsTable = $(overviewTroopsPage).find('#units_table tbody');
                if (!troopsTable.length) break;

                const lastVillageIdTemp = $(troopsTable).find('span').eq(0).attr('data-id');
                if (!lastVillageIdTemp) break;

                if (lastVillageId !== null && lastVillageId === lastVillageIdTemp) break;
                lastVillageId = lastVillageIdTemp;

                const currentObj = this;
                $.each(troopsTable, function (id, tbodyObj) {
                    const villageTroops = $(tbodyObj).find('tr').eq(0);
                    const villageTroopsLine = $(villageTroops).find('td:gt(1)');
                    let c = 0;

                    $.each(currentObj.availableUnits, function (key, value) {
                        troopsObj.villagesTroops[value] += parseInt(villageTroopsLine.eq(c).text().trim(), 10) || 0;
                        c++;
                    });
                });

                currentPage++;
                await this.#waitMilliseconds(lastRunTime, 200);
            } while (true);

            return troopsObj;
        }

        async #setMaxLinesPerPage(screen, mode, value) {
            await new Promise(res => setTimeout(res, 200));

            const form = document.createElement("form");
            form.method = "POST";
            form.action = "#";

            $.each({ page_size: value, h: game_data.csrf }, function (key, value) {
                const input = document.createElement('input');
                input.name = key;
                input.value = value;
                form.appendChild(input);
            });

            const dataString = $(form).serialize();

            $.ajax({
                type: 'POST',
                url: this.#generateUrl(screen, mode, { action: 'change_page_size', type: 'all' }),
                data: dataString,
                async: false
            });
        }

        #getGroupsObj() {
            const html = $.parseHTML(
                this.#fetchHtmlPage(this.#generateUrl('overview_villages', 'groups', { type: 'static' }))
            );

            let groups = $(html).find('.vis_item').find('a,strong');
            const groupsArr = {};

            if ($(groups).length > 0) {
                $.each(groups, function (id, group) {
                    const val = $(group).text().trim();
                    groupsArr[group.getAttribute('data-group-id')] = val.substring(1, val.length - 1);
                });
            } else {
                groups = $(html).find('.vis_item select option');
                $.each(groups, function (id, group) {
                    groupsArr[(new URLSearchParams($(group).val())).get('group')] = $(group).text().trim();
                });
            }

            return groupsArr;
        }

        #buildTotalTroopsObj(troopsObj) {
            const merged = {};
            $.each(troopsObj.villagesTroops, function (key, value) {
                merged[key] = value + (troopsObj.scavengingTroops[key] || 0);
            });
            return merged;
        }

        #buildDiscordDefensiveTroops(totalTroops) {
            return {
                spear: totalTroops.spear || 0,
                sword: totalTroops.sword || 0,
                spy: totalTroops.spy || 0,
                heavy: totalTroops.heavy || 0,
                catapult: totalTroops.catapult || 0,
                knight: totalTroops.knight || 0
            };
        }

        #buildVisibleDefensiveTroops(totalTroops) {
            return {
                spear: totalTroops.spear || 0,
                sword: totalTroops.sword || 0,
                archer: totalTroops.archer || 0,
                spy: totalTroops.spy || 0,
                heavy: totalTroops.heavy || 0,
                catapult: totalTroops.catapult || 0,
                knight: totalTroops.knight || 0
            };
        }

        #calculateOffensivePop(v) {
            return (v.axe || 0) * 1 +
                (v.light || 0) * 4 +
                (v.marcher || 0) * 5 +
                (v.ram || 0) * 5 +
                (v.catapult || 0) * 8;
        }

        #calculateNukeStatusByVillageArray(villagesArray) {
            const status = { full: 0, semi: 0, rebuilding: 0 };

            villagesArray.forEach(v => {
                const pop = this.#calculateOffensivePop(v);
                if (pop >= 19000) status.full++;
                else if (pop >= 10000) status.semi++;
                else if (pop >= 2000) status.rebuilding++;
            });

            return status;
        }

        async #getVillageRowsForNukes() {
            const villages = [];
            let currentPage = 0;
            let lastRunTime = Date.now();

            await this.#setMaxLinesPerPage('overview_villages', 'units', 1000);
            await this.#waitMilliseconds(lastRunTime, 200);

            let lastVillageId = null;

            do {
                lastRunTime = Date.now();

                const rawPage = this.#fetchHtmlPage(
                    this.#generateUrl('overview_villages', 'units', { page: currentPage })
                );
                if (!rawPage) break;

                const overviewTroopsPage = $.parseHTML(rawPage);
                const troopsTable = $(overviewTroopsPage).find('#units_table tbody');
                if (!troopsTable.length) break;

                const lastVillageIdTemp = $(troopsTable).find('span').eq(0).attr('data-id');
                if (!lastVillageIdTemp) break;

                if (lastVillageId !== null && lastVillageId === lastVillageIdTemp) break;
                lastVillageId = lastVillageIdTemp;

                const currentObj = this;
                $.each(troopsTable, function (id, tbodyObj) {
                    const villageTroops = $(tbodyObj).find('tr').eq(0);
                    const villageTroopsLine = $(villageTroops).find('td:gt(1)');
                    let c = 0;
                    const villageData = {};

                    $.each(currentObj.availableUnits, function (key, value) {
                        villageData[value] = parseInt(villageTroopsLine.eq(c).text().trim(), 10) || 0;
                        c++;
                    });

                    villages.push(villageData);
                });

                currentPage++;
                await this.#waitMilliseconds(lastRunTime, 200);
            } while (true);

            return villages;
        }

        async #getNukeStatus() {
            const villagesArray = await this.#getVillageRowsForNukes();
            return this.#calculateNukeStatusByVillageArray(villagesArray);
        }

        #getCurrentGroupName() {
            const groups = this.#getGroupsObj();
            return (game_data.group_id && groups[game_data.group_id]) || this.UserTranslation.noGroup;
        }

        #getServerTime() {
            return $('#serverDate').text() + ' ' + $('#serverTime').text();
        }

        #formatNumber(value) {
            return new Intl.NumberFormat('pt-PT').format(Number(value || 0));
        }

        #getUnitLabel(key) {
            const unitLabel = {
                spear: 'Lanceiros',
                sword: 'Espadachins',
                axe: 'Vikings',
                archer: 'Arqueiros',
                spy: 'Batedores',
                light: 'Cavalaria Leve',
                marcher: 'Arqueiros Montados',
                heavy: 'Cavalaria Pesada',
                ram: 'Aríetes',
                catapult: 'Catapultas',
                knight: 'Paladinos',
                snob: 'Nobres'
            };
            return unitLabel[key] || '';
        }

        #getTroopsBBCode(totalTroops) {
            const currentGroup = this.#getCurrentGroupName();
            let bbCode = `[b]Contagem de Tropas (${this.#getServerTime()})[/b]\n`;
            bbCode += `[b]Grupo Atual:[/b] ${currentGroup}\n\n`;

            for (let [key, value] of Object.entries(totalTroops)) {
                bbCode += `[unit]${key}[/unit] [b]${this.#formatNumber(value)}[/b] ${this.#getUnitLabel(key)}\n`;
            }

            return bbCode;
        }

        #sendToDiscordBotCompatible(discordDefensiveTroops) {
            const playerName = game_data.player.name;
            const currentGroup = this.#getCurrentGroupName();

            if (typeof webhookURL !== 'string' || !webhookURL.startsWith('https://discord.com/api/webhooks/')) {
                alert("❌ Webhook inválido ou não definido. Por favor insere o teu webhook no botão da quickbar.");
                return;
            }

            const embedData = {
                content: `**Tropa Defensiva (Atualizado em: ${this.#getServerTime()})**\n**Jogador:** ${playerName}`,
                embeds: [
                    {
                        title: "**🛡️ TROPA DEFENSIVA**",
                        fields: [
                            { name: "🗂️ **Grupo Atual**", value: currentGroup, inline: false },
                            { name: "<:lanceiro:1368839513891409972> **Lanceiros**", value: `${discordDefensiveTroops.spear || 0}`, inline: true },
                            { name: "<:espadachim:1368839514746785844> **Espadachins**", value: `${discordDefensiveTroops.sword || 0}`, inline: true },
                            { name: "<:batedor:1368839512423137404> **Batedores**", value: `${discordDefensiveTroops.spy || 0}`, inline: true },
                            { name: "<:pesada:1368839517997498398> **Cavalaria Pesada**", value: `${discordDefensiveTroops.heavy || 0}`, inline: true },
                            { name: "<:catapulta:1368839516441280573> **Catapultas**", value: `${discordDefensiveTroops.catapult || 0}`, inline: true },
                            { name: "<:paladino:1368332901728391319> **Paladinos**", value: `${discordDefensiveTroops.knight || 0}`, inline: true }
                        ]
                    }
                ]
            };

            $.ajax({
                url: webhookURL,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(embedData),
                success: function () {
                    alert("Defesa compartilhada com a liderança!");
                },
                error: function () {
                    alert("Houve um erro ao enviar os dados para o Discord.");
                }
            });
        }

        async #createUI() {
            UI.InfoMessage(this.UserTranslation.loadingMessage);

            const troopsObj = this.isScavengingWorld
                ? await this.#getTroopsScavengingWorldObj()
                : await this.#getTroopsNonScavengingWorldObj();

            if (!troopsObj || !troopsObj.villagesTroops) {
                UI.ErrorMessage(this.UserTranslation.errorMessages.troopsReadError);
                return;
            }

            this.lastTroopsObj = troopsObj;

            const totalTroops = this.#buildTotalTroopsObj(troopsObj);
            const discordDefensiveTroops = this.#buildDiscordDefensiveTroops(totalTroops);
            const visibleDefensiveTroops = this.#buildVisibleDefensiveTroops(totalTroops);
            const nukeStatus = await this.#getNukeStatus();
            const bbCode = this.#getTroopsBBCode(totalTroops);

            const html = `
<div id="dd-root">
    <div class="dd-head">
        <h3>${this.UserTranslation.title}</h3>
        <div class="dd-sub">${this.UserTranslation.subtitle}</div>
    </div>

    <div class="dd-toolbar">
        <div class="dd-meta">
            <span><b>${this.UserTranslation.group}:</b> ${this.#getCurrentGroupName()}</span>
            <span><b>${this.UserTranslation.player}:</b> ${game_data.player.name}</span>
            <span><b>${this.UserTranslation.server}:</b> ${this.#getServerTime()}</span>
        </div>
        <div class="dd-actions">
            ${getGroupsHtml(this)}
            <button id="dd-refresh">${this.UserTranslation.refresh}</button>
            <button id="dd-send-discord">${this.UserTranslation.sendDiscord}</button>
        </div>
    </div>

    <div class="dd-nukes">
        <div class="dd-nuke-card dd-full">
            <div class="dd-nuke-icon">🚀</div>
            <div class="dd-nuke-value">${nukeStatus.full}</div>
            <div class="dd-nuke-label">${this.UserTranslation.full}</div>
        </div>
        <div class="dd-nuke-card dd-semi">
            <div class="dd-nuke-icon">📈</div>
            <div class="dd-nuke-value">${nukeStatus.semi}</div>
            <div class="dd-nuke-label">${this.UserTranslation.semi}</div>
        </div>
        <div class="dd-nuke-card dd-rec">
            <div class="dd-nuke-icon">🛠️</div>
            <div class="dd-nuke-value">${nukeStatus.rebuilding}</div>
            <div class="dd-nuke-label">${this.UserTranslation.rebuilding}</div>
        </div>
    </div>

    <table id="support_sum" class="vis overview_table" width="100%">
        <thead>
            ${getTroopsHeader(this.availableUnits)}
        </thead>
        <tbody>
            ${this.isScavengingWorld ? getTroopsLine(this.UserTranslation.home, troopsObj.villagesTroops) : ''}
            ${this.isScavengingWorld ? getTroopsLine(this.UserTranslation.scavenging, troopsObj.scavengingTroops) : ''}
            ${getTroopsLine(this.UserTranslation.total, troopsObj, 1)}
        </tbody>
    </table>

    <div class="dd-def">
        <h4>${this.UserTranslation.defensiveTotal}</h4>
        <table class="vis overview_table" width="100%">
            <thead>
                <tr>
                    <th><img src="/graphic/unit/unit_spear.webp"></th>
                    <th><img src="/graphic/unit/unit_sword.webp"></th>
                    ${game_data.units.includes('archer') ? '<th><img src="/graphic/unit/unit_archer.webp"></th>' : ''}
                    <th><img src="/graphic/unit/unit_spy.webp"></th>
                    <th><img src="/graphic/unit/unit_heavy.webp"></th>
                    <th><img src="/graphic/unit/unit_catapult.webp"></th>
                    ${game_data.units.includes('knight') ? '<th><img src="/graphic/unit/unit_knight.webp"></th>' : ''}
                </tr>
            </thead>
            <tbody>
                <tr style="text-align:center">
                    <td>${this.#formatNumber(visibleDefensiveTroops.spear)}</td>
                    <td>${this.#formatNumber(visibleDefensiveTroops.sword)}</td>
                    ${game_data.units.includes('archer') ? `<td>${this.#formatNumber(visibleDefensiveTroops.archer)}</td>` : ''}
                    <td>${this.#formatNumber(visibleDefensiveTroops.spy)}</td>
                    <td>${this.#formatNumber(visibleDefensiveTroops.heavy)}</td>
                    <td>${this.#formatNumber(visibleDefensiveTroops.catapult)}</td>
                    ${game_data.units.includes('knight') ? `<td>${this.#formatNumber(visibleDefensiveTroops.knight)}</td>` : ''}
                </tr>
            </tbody>
        </table>
    </div>

    <div class="dd-bbcode">
        <h4>Exportar Contagem de Tropas</h4>
        <textarea readonly id="dd-bbcode-area">${bbCode.trim()}</textarea>
    </div>

    <br>
    <span style="font-weight:bold;font-size:10px;">${this.UserTranslation.credits}</span>
</div>

<style>
.popup_box_content { min-width: 820px; }
.mds .popup_box_content { min-width: unset !important; }

#dd-root h3 { margin: 0; }
#dd-root .dd-head { margin-bottom: 12px; }
#dd-root .dd-sub { color: #666; font-size: 11px; margin-top: 4px; }

#dd-root .dd-toolbar {
    display:flex;
    justify-content:space-between;
    align-items:center;
    gap:12px;
    flex-wrap:wrap;
    margin-bottom:15px;
}

#dd-root .dd-meta {
    display:flex;
    gap:10px;
    flex-wrap:wrap;
    font-size:12px;
}

#dd-root .dd-actions {
    display:flex;
    gap:8px;
    align-items:center;
    flex-wrap:wrap;
}

#dd-root .dd-actions select,
#dd-root .dd-actions button {
    height: 32px;
}

#dd-root .dd-actions button {
    padding: 0 12px;
    border: 1px solid #7d510f;
    background: linear-gradient(to bottom,#f4e4bc 0%,#d7c08a 100%);
    cursor: pointer;
    font-weight: bold;
    border-radius: 4px;
}

#dd-root .dd-nukes {
    display:flex;
    gap:12px;
    margin: 12px 0 16px;
    flex-wrap:wrap;
}

#dd-root .dd-nuke-card {
    flex: 1 1 150px;
    text-align:center;
    padding:12px;
    border-radius:6px;
    color:#fff;
    font-weight:bold;
}

#dd-root .dd-full { background:#8b0000; }
#dd-root .dd-semi { background:#cd5c5c; }
#dd-root .dd-rec  { background:#777; }

#dd-root .dd-nuke-icon { font-size:18px; margin-bottom:4px; }
#dd-root .dd-nuke-value { font-size:22px; }
#dd-root .dd-nuke-label { font-size:12px; margin-top:4px; }

#dd-root .dd-def h4,
#dd-root .dd-bbcode h4 {
    margin: 14px 0 8px;
}

#dd-bbcode-area {
    width: 100%;
    min-height: 120px;
    resize: vertical;
    box-sizing: border-box;
}
</style>
`;

            Dialog.show(DIALOG_ID, html, Dialog.close());
            $('#popup_box_' + DIALOG_ID).css('width', 'unset');

            $(document).off('click.' + SCRIPT_NS, '#dd-send-discord');
            $(document).on('click.' + SCRIPT_NS, '#dd-send-discord', () => {
                this.#sendToDiscordBotCompatible(discordDefensiveTroops);
            });

            $(document).off('click.' + SCRIPT_NS, '#dd-refresh');
            $(document).on('click.' + SCRIPT_NS, '#dd-refresh', async () => {
                try { Dialog.close(); } catch (e) {}
                await this.#createUI();
            });

            UI.SuccessMessage(this.UserTranslation.successMessage, 500);

            function getGroupsHtml(objInstance) {
                const groups = objInstance.#getGroupsObj();
                let html = '';
                $.each(groups, function (groupId, group) {
                    const selected = String(game_data.group_id) === String(groupId) ? 'selected' : '';
                    html += `<option value="${groupId}" ${selected}>${group}</option>`;
                });
                return `<select id="dd-group-select" onchange="villagesTroopsCounter.changeGroup(this)">${html}</select>`;
            }

            function getTroopsLine(translation, troopsObj, type = null) {
                const troops = type === null ? (() => troopsObj) : (() => {
                    const merged = {};
                    $.each(troopsObj.villagesTroops, function (key, value) {
                        merged[key] = value + (troopsObj.scavengingTroops[key] || 0);
                    });
                    return merged;
                });

                let html = `<tr><td class="center" style="text-wrap: nowrap;">${translation}</td>`;
                $.each(troops(), function (key, value) {
                    html += `<td class="center" data-unit="${key}">${value}</td>`;
                });
                html += `</tr>`;
                return html;
            }

            function getTroopsHeader(availableUnits) {
                let html = `<tr><th class="center" style="width:0px;"></th>`;
                $.each(availableUnits, function (key, value) {
                    html += `<th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="${value}"><img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${value}.png"></a></th>`;
                });
                html += `</tr>`;
                return html;
            }
        }

        async changeGroup(obj) {
            const groupId = obj.value;
            this.#fetchHtmlPage(this.#generateUrl('overview_villages', null, { group: groupId }));
            game_data.group_id = groupId;
            await this.#createUI();
        }
    }

    window.villagesTroopsCounter = new VillagesTroopsCounter();
    window.villagesTroopsCounter.init();
})();
