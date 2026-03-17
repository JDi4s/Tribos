/*
* Script Name: Troop Counter Saven + Discord
* Base: NunoF-
* Edit: botão Discord + envio do total
*/

var webhookURL = 'https://discord.com/api/webhooks/1477668553166422189/TaOeFZGwxb2c0_b7ytfXujYv-9QM470fO_Hlx8DZaVnToXpFtnLMeHHLkWSTwFTDH6fF';

if (typeof villagesTroopsCounter !== 'undefined') {
    villagesTroopsCounter.init();
} else {
class VillagesTroopsCounter {
    static VillagesTroopsCounterTranslations() {
        return {
            en_US: {
                title: 'Home and Scavenging Troops Counter',
                home: 'Home',
                scavenging: 'Scavenging',
                total: 'Total',
                sendDiscord: 'Share total defense to ticket',
                errorMessages: {
                    premiumRequired: 'Error. A premium account is required to run this script!',
                    errorFetching: 'An error occured while trying to fetch the following URL:',
                    missingSavengeMassScreenElement: 'An error occurred trying to located the ScavengeMassScreen element inside the mass scavenge page.',
                    invalidWebhook: 'Invalid or missing Discord webhook.'
                },
                successMessage: 'Loaded successfully!',
                loadingMessage: 'Loading...',
                loadingWorldConfigMessage: 'Loading world config...',
                discordSuccess: 'Defense sent to Discord successfully!',
                discordError: 'There was an error sending the defense to Discord.',
                credits: 'Village Troops Counter + Discord edit'
            },
            pt_PT: {
                title: 'Contador de tropas em casa e em buscas',
                home: 'Em casa',
                scavenging: 'Em busca',
                total: 'Total',
                sendDiscord: 'Partilhar defesa disponível no ticket',
                errorMessages: {
                    premiumRequired: 'Erro. É necessário possuir conta premium para correr este script!',
                    errorFetching: 'Ocorreu um erro ao tentar carregar o seguinte URL:',
                    missingSavengeMassScreenElement: 'Ocorreu um erro ao tentar localizar o elemento ScavengeMassScreen dentro da página de buscas em massa.',
                    invalidWebhook: 'Webhook do Discord inválido ou não definido.'
                },
                successMessage: 'Carregado com sucesso!',
                loadingMessage: 'A carregar...',
                loadingWorldConfigMessage: 'A carregar configurações do mundo...',
                discordSuccess: 'Defesa enviada para o Discord com sucesso!',
                discordError: 'Ocorreu um erro ao enviar a defesa para o Discord.',
                credits: 'Contador de tropas em casa e em buscas + Discord'
            }
        };
    }

    constructor() {
        this.UserTranslation =
            game_data.locale in VillagesTroopsCounter.VillagesTroopsCounterTranslations()
                ? VillagesTroopsCounter.VillagesTroopsCounterTranslations()[game_data.locale]
                : VillagesTroopsCounter.VillagesTroopsCounterTranslations().en_US;

        this.availableSupportUnits = Object.create(game_data.units);
        this.availableSupportUnits = Object.getPrototypeOf(this.availableSupportUnits);
        this.availableSupportUnits.splice(this.availableSupportUnits.indexOf('militia'), 1);

        this.worldConfig = null;
        this.isScavengingWorld = false;
        this.worldConfigFileName = `worldConfigFile${game_data.world}`;
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
        this.worldConfig = $.parseXML(worldConfig);
        this.isScavengingWorld =
            this.worldConfig
                .getElementsByTagName('config')[0]
                .getElementsByTagName('game')[0]
                .getElementsByTagName('scavenging')[0]
                .textContent.trim() === '1';
    }

    async #getWorldConfig() {
        const xml = this.#fetchHtmlPage('/interface.php?func=get_config');
        localStorage.setItem(
            this.worldConfigFileName,
            (new XMLSerializer()).serializeToString(xml)
        );
        await this.#waitMilliseconds(Date.now(), 200);
        return xml;
    }

    async #waitMilliseconds(lastRunTime, milliseconds = 0) {
        await new Promise(res =>
            setTimeout(res, Math.max(lastRunTime + milliseconds - Date.now(), 0))
        );
    }

    #generateUrl(screen, mode = null, extraParams = {}) {
        let url = `/game.php?village=${game_data.village.id}&screen=${screen}`;
        if (mode !== null) url += `&mode=${mode}`;

        $.each(extraParams, function (key, value) {
            url += `&${key}=${value}`;
        });

        if (game_data.player.sitter !== '0') url += '&t=' + game_data.player.id;
        return url;
    }

    #initTroops() {
        const troops = {};
        this.availableSupportUnits.forEach(function (unit) {
            troops[unit] = 0;
        });
        return troops;
    }

    #fetchHtmlPage(url) {
        let temp_data = null;
        $.ajax({
            async: false,
            url: url,
            type: 'GET',
            success: function (data) {
                temp_data = data;
            },
            error: (jqXHR) => {
                console.log(jqXHR);
                UI.ErrorMessage(`${this.UserTranslation.errorMessages.errorFetching} ${url}`);
            }
        });
        return temp_data;
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

            $.each(scavengingObject, function (_, villageData) {
                $.each(villageData.unit_counts_home, function (key, value) {
                    if (key !== 'militia') troopsObj.villagesTroops[key] += value;
                });

                $.each(villageData.options, function (_, option) {
                    if (option.scavenging_squad !== null) {
                        $.each(option.scavenging_squad.unit_counts, function (key, value) {
                            if (key !== 'militia') troopsObj.scavengingTroops[key] += value;
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

            const matches = html.match(/ScavengeMassScreen[\s\S]*?(,\n *\[.*?\}{0,3}\],\n)/);
            if (!matches || matches.length <= 1) {
                UI.ErrorMessage(currentObj.UserTranslation.errorMessages.missingSavengeMassScreenElement);
                return false;
            }

            let json = matches[1];
            json = json.substring(json.indexOf('['));
            json = json.substring(0, json.length - 2);
            return JSON.parse(json);
        }
    }

    async #getTroopsNonScavengingWorldObj() {
        const troopsObj = {
            villagesTroops: this.#initTroops(),
            scavengingTroops: this.#initTroops()
        };

        let currentPage = 0;
        let lastRunTime = Date.now();

        await this.#setMaxLinesPerPage(this, 'overview_villages', 'units', 1000);
        await this.#waitMilliseconds(lastRunTime, 200);

        let lastVillageId = null;

        do {
            lastRunTime = Date.now();
            const overviewTroopsPage = $.parseHTML(
                this.#fetchHtmlPage(this.#generateUrl('overview_villages', 'units', { page: currentPage }))
            );
            const troopsTable = $(overviewTroopsPage).find('#units_table tbody');

            const lastVillageIdTemp = $(troopsTable).find('span').eq(0).attr('data-id');
            if (lastVillageId !== null && lastVillageId === lastVillageIdTemp) break;
            lastVillageId = lastVillageIdTemp;

            const currentObj = this;
            $.each(troopsTable, function (_, tbodyObj) {
                const villageTroops = $(tbodyObj).find('tr').eq(0);
                const villageTroopsLine = $(villageTroops).find('td:gt(1)');
                let c = 0;

                $.each(currentObj.availableSupportUnits, function (_, value) {
                    troopsObj.villagesTroops[value] += parseInt(villageTroopsLine.eq(c).text().trim(), 10) || 0;
                    c++;
                });
            });

            currentPage++;
            await this.#waitMilliseconds(lastRunTime, 200);
        } while (true);

        return troopsObj;
    }

    async #setMaxLinesPerPage(currentObj, screen, mode, value) {
        await new Promise(res => setTimeout(res, 200));

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '#';

        $.each({ page_size: value, h: game_data.csrf }, function (key, value) {
            const input = document.createElement('input');
            input.name = key;
            input.value = value;
            form.appendChild(input);
        });

        const dataString = $(form).serialize();
        $.ajax({
            type: 'POST',
            url: currentObj.#generateUrl(screen, mode, { action: 'change_page_size', type: 'all' }),
            data: dataString,
            async: false
        });
    }

    #getGroupsObj() {
        const html = $.parseHTML(this.#fetchHtmlPage(this.#generateUrl('overview_villages', 'groups', { type: 'static' })));
        let groups = $(html).find('.vis_item').find('a,strong');
        const groupsArr = {};

        if ($(groups).length > 0) {
            $.each(groups, function (_, group) {
                const val = $(group).text().trim();
                groupsArr[group.getAttribute('data-group-id')] = val.substring(1, val.length - 1);
            });
        } else {
            groups = $(html).find('.vis_item select option');
            $.each(groups, function (_, group) {
                groupsArr[(new URLSearchParams($(group).val())).get('group')] = $(group).text().trim();
            });
        }

        return groupsArr;
    }

    #buildTotalTroopsObj(troopsObj) {
        const total = {};
        $.each(troopsObj.villagesTroops, function (key, value) {
            total[key] = value + (troopsObj.scavengingTroops[key] || 0);
        });
        return total;
    }

    #sendToDiscord(totalTroops) {
        if (typeof webhookURL !== 'string' || !webhookURL.startsWith('https://discord.com/api/webhooks/')) {
            UI.ErrorMessage(this.UserTranslation.errorMessages.invalidWebhook);
            return;
        }

        let currentGroup = (game_data.group_id && this.#getGroupsObj()[game_data.group_id]) || 'todos';
        currentGroup = String(currentGroup).trim();

        const embedData = {
            content: `**Tropa Defensiva (Atualizado em: ${this.#getServerTime()})**\n**Jogador:** ${game_data.player.name}`,
            embeds: [
                {
                    title: '**🛡️ TROPA DEFENSIVA**',
                    fields: [
                        { name: '🗂️ **Grupo Atual**', value: currentGroup, inline: false },
                        { name: '<:lanceiro:1368839513891409972> **Lanceiros**', value: `${totalTroops.spear || 0}`, inline: true },
                        { name: '<:espadachim:1368839514746785844> **Espadachins**', value: `${totalTroops.sword || 0}`, inline: true },
                        { name: '<:batedor:1368839512423137404> **Batedores**', value: `${totalTroops.spy || 0}`, inline: true },
                        { name: '<:pesada:1368839517997498398> **Cavalaria Pesada**', value: `${totalTroops.heavy || 0}`, inline: true },
                        { name: '<:catapulta:1368839516441280573> **Catapultas**', value: `${totalTroops.catapult || 0}`, inline: true },
                        { name: '<:paladino:1368332901728391319> **Paladinos**', value: `${totalTroops.knight || 0}`, inline: true }
                    ]
                }
            ]
        };

        $.ajax({
            url: webhookURL,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(embedData),
            success: () => UI.SuccessMessage(this.UserTranslation.discordSuccess, 3000),
            error: () => UI.ErrorMessage(this.UserTranslation.discordError)
        });
    }

    #getServerTime() {
        const serverTime = jQuery('#serverTime').text();
        const serverDate = jQuery('#serverDate').text();
        return `${serverDate} ${serverTime}`;
    }

    async #createUI() {
        UI.InfoMessage(this.UserTranslation.loadingMessage);

        this.lastTroopsObj = this.isScavengingWorld
            ? await this.#getTroopsScavengingWorldObj()
            : await this.#getTroopsNonScavengingWorldObj();

        const totalTroops = this.#buildTotalTroopsObj(this.lastTroopsObj);

        const html = `
<div>
    <br>
    <h3 style="position:relative;">${this.UserTranslation.title}</h3>
    ${getGroupsHtml(this)}
    <br><br>
    <table id="support_sum" class="vis overview_table" width="100%">
        <thead>
            ${getTroopsHeader(this.availableSupportUnits)}
        </thead>
        <tbody>
            ${this.isScavengingWorld ? getTroopsLine(this.UserTranslation.home, this.lastTroopsObj.villagesTroops) : ''}
            ${this.isScavengingWorld ? getTroopsLine(this.UserTranslation.scavenging, this.lastTroopsObj.scavengingTroops) : ''}
            ${getTroopsLine(this.UserTranslation.total, totalTroops)}
        </tbody>
    </table>

    <div style="text-align:center; margin-top:15px;">
        <button id="sendToDiscord" class="btn">
            ${this.UserTranslation.sendDiscord}
        </button>
    </div>
</div>

<style>
.popup_box_content {
    min-width: 600px;
}

.mds .popup_box_content {
    min-width: unset !important;
}

#sendToDiscord {
    margin-top: 10px;
}
</style>

<br>
<span style="font-weight:bold;font-size:10px;">${this.UserTranslation.credits}</span>
`;

        Dialog.show('import', html, Dialog.close());
        $('#popup_box_import').css('width', 'unset');
        UI.SuccessMessage(this.UserTranslation.successMessage, 500);

        $('#sendToDiscord').off('click').on('click', () => {
            this.#sendToDiscord(totalTroops);
        });

        function getGroupsHtml(objInstance) {
            const groups = objInstance.#getGroupsObj();
            let html = '';
            $.each(groups, function (groupId, group) {
                const selected = game_data.group_id === groupId ? 'selected' : '';
                html += `<option value="${groupId}" ${selected}>${group}</option>`;
            });
            return '<select onchange="villagesTroopsCounter.changeGroup(this)">' + html + '</select>';
        }

        function getTroopsLine(label, troopsObj) {
            let html = `<tr><td class="center" style="text-wrap: nowrap;">${label}</td>`;
            $.each(troopsObj, function (key, value) {
                html += `<td class="center" data-unit="${key}">${value}</td>`;
            });
            html += `</tr>`;
            return html;
        }

        function getTroopsHeader(availableSupportUnits) {
            let html = `<tr><th class="center" style="width:0px;"></th>`;
            $.each(availableSupportUnits, function (_, value) {
                html += `<th style="text-align:center" width="35"><a href="#" class="unit_link" data-unit="${value}"><img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_${value}.png"></a></th>`;
            });
            html += `</tr>`;
            return html;
        }
    }

    async changeGroup(obj) {
        this.#fetchHtmlPage(this.#generateUrl('overview_villages', null, { group: obj.value }));
        game_data.group_id = obj.value;
        await this.#createUI();
    }
}

var villagesTroopsCounter = new VillagesTroopsCounter();
villagesTroopsCounter.init();
}
