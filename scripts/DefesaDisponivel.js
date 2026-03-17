(function () {
    var webhookURL = window.webhookURL || 'COLOCA_AQUI_O_TEU_WEBHOOK_DISCORD';
    var SCRIPT_NS = 'vtc_modern';
    var DIALOG_ID = 'vtc_modern_dialog';

    try { $(document).off('.' + SCRIPT_NS); } catch (e) {}
    try { Dialog.close(); } catch (e) {}
    try { delete window.villagesTroopsCounter; } catch (e) { window.villagesTroopsCounter = undefined; }

    var VTC = {
        t: null,
        availableSupportUnits: [],
        worldConfig: null,
        isScavengingWorld: false,
        worldConfigFileName: null,
        lastTroopsObj: null,

        translations: function () {
            return {
                en_US: {
                    title: 'Troops Counter',
                    subtitle: 'Home, scavenging and total troops',
                    home: 'Home',
                    scavenging: 'Scavenging',
                    total: 'Total',
                    group: 'Current group',
                    refresh: 'Refresh',
                    sendDiscord: 'Send to Discord',
                    noGroup: 'All',
                    player: 'Player',
                    server: 'Server',
                    errorMessages: {
                        premiumRequired: 'Error. A premium account is required to run this script!',
                        errorFetching: 'An error occurred while trying to fetch the following URL:',
                        missingSavengeMassScreenElement: 'Could not locate ScavengeMassScreen in the mass scavenging page.',
                        invalidWebhook: 'Invalid or missing Discord webhook.'
                    },
                    successMessage: 'Loaded successfully!',
                    loadingMessage: 'Loading troops...',
                    loadingWorldConfigMessage: 'Loading world configuration...',
                    discordSuccess: 'Defense sent to Discord successfully!',
                    discordError: 'There was an error sending the defense to Discord.',
                    credits: 'Modern Troops Counter'
                },
                pt_PT: {
                    title: 'Contador de Tropas',
                    subtitle: 'Tropas em casa, em busca e total',
                    home: 'Em casa',
                    scavenging: 'Em busca',
                    total: 'Total',
                    group: 'Grupo atual',
                    refresh: 'Atualizar',
                    sendDiscord: 'Enviar para Discord',
                    noGroup: 'Todos',
                    player: 'Jogador',
                    server: 'Servidor',
                    errorMessages: {
                        premiumRequired: 'Erro. É necessário possuir conta premium para correr este script!',
                        errorFetching: 'Ocorreu um erro ao tentar carregar o seguinte URL:',
                        missingSavengeMassScreenElement: 'Ocorreu um erro ao tentar localizar o elemento ScavengeMassScreen dentro da página de buscas em massa.',
                        invalidWebhook: 'Webhook do Discord inválido ou não definido.'
                    },
                    successMessage: 'Carregado com sucesso!',
                    loadingMessage: 'A carregar tropas...',
                    loadingWorldConfigMessage: 'A carregar configurações do mundo...',
                    discordSuccess: 'Defesa enviada para o Discord com sucesso!',
                    discordError: 'Ocorreu um erro ao enviar a defesa para o Discord.',
                    credits: 'Contador de tropas moderno'
                }
            };
        },

        init: async function () {
            var allTranslations = this.translations();
            this.t = allTranslations[game_data.locale] || allTranslations.en_US;

            if (!game_data.features.Premium.active) {
                UI.ErrorMessage(this.t.errorMessages.premiumRequired);
                return;
            }

            this.availableSupportUnits = [].concat(game_data.units || []);
            var militiaIndex = this.availableSupportUnits.indexOf('militia');
            if (militiaIndex !== -1) this.availableSupportUnits.splice(militiaIndex, 1);

            this.worldConfigFileName = 'worldConfigFile_' + game_data.world;

            await this.initWorldConfig();
            await this.createUI();
        },

        initWorldConfig: async function () {
            var worldConfig = localStorage.getItem(this.worldConfigFileName);

            if (worldConfig === null) {
                UI.InfoMessage(this.t.loadingWorldConfigMessage);
                worldConfig = await this.getWorldConfig();
            }

            this.worldConfig = $.parseXML(worldConfig);
            this.isScavengingWorld =
                this.worldConfig
                    .getElementsByTagName('config')[0]
                    .getElementsByTagName('game')[0]
                    .getElementsByTagName('scavenging')[0]
                    .textContent.trim() === '1';
        },

        getWorldConfig: async function () {
            var xml = this.fetchHtmlPage('/interface.php?func=get_config');
            var xmlString = typeof xml === 'string' ? xml : new XMLSerializer().serializeToString(xml);
            localStorage.setItem(this.worldConfigFileName, xmlString);
            await this.waitMilliseconds(Date.now(), 200);
            return xmlString;
        },

        waitMilliseconds: async function (lastRunTime, milliseconds) {
            milliseconds = milliseconds || 0;
            await new Promise(function (res) {
                setTimeout(res, Math.max((lastRunTime || 0) + milliseconds - Date.now(), 0));
            });
        },

        generateUrl: function (screen, mode, extraParams) {
            mode = typeof mode === 'undefined' ? null : mode;
            extraParams = extraParams || {};

            var url = '/game.php?village=' + game_data.village.id + '&screen=' + screen;
            if (mode !== null) url += '&mode=' + mode;

            $.each(extraParams, function (key, value) {
                url += '&' + key + '=' + value;
            });

            if (game_data.player.sitter !== '0') url += '&t=' + game_data.player.id;
            return url;
        },

        initTroops: function () {
            var troops = {};
            this.availableSupportUnits.forEach(function (unit) {
                troops[unit] = 0;
            });
            return troops;
        },

        fetchHtmlPage: function (url) {
            var tempData = null;
            var self = this;

            $.ajax({
                async: false,
                url: url,
                type: 'GET',
                success: function (data) {
                    tempData = data;
                },
                error: function () {
                    UI.ErrorMessage(self.t.errorMessages.errorFetching + ' ' + url);
                }
            });

            return tempData;
        },

        getTroopsScavengingWorldObj: async function () {
            var troopsObj = {
                villagesTroops: this.initTroops(),
                scavengingTroops: this.initTroops()
            };

            var currentPage = 0;
            var lastRunTime = null;

            while (true) {
                var scavengingObject = await this.getScavengeMassScreenJson(currentPage, lastRunTime);
                if (!scavengingObject) return troopsObj;
                if (scavengingObject.length === 0) break;

                lastRunTime = Date.now();

                $.each(scavengingObject, function (_, villageData) {
                    $.each(villageData.unit_counts_home, function (key, value) {
                        if (key !== 'militia' && typeof troopsObj.villagesTroops[key] !== 'undefined') {
                            troopsObj.villagesTroops[key] += value;
                        }
                    });

                    $.each(villageData.options, function (_, option) {
                        if (option.scavenging_squad !== null) {
                            $.each(option.scavenging_squad.unit_counts, function (key, value) {
                                if (key !== 'militia' && typeof troopsObj.scavengingTroops[key] !== 'undefined') {
                                    troopsObj.scavengingTroops[key] += value;
                                }
                            });
                        }
                    });
                });

                currentPage++;
            }
        },

        getScavengeMassScreenJson: async function (currentPage, lastRunTime) {
            await this.waitMilliseconds(lastRunTime, 200);

            var html = this.fetchHtmlPage(
                this.generateUrl('place', 'scavenge_mass', { page: currentPage })
            );

            if (!html) return false;

            var matches = html.match(/ScavengeMassScreen[\s\S]*?(,\n *\[.*?\}{0,3}\],\n)/);

            if (!matches || matches.length <= 1) {
                UI.ErrorMessage(this.t.errorMessages.missingSavengeMassScreenElement);
                return false;
            }

            var json = matches[1];
            json = json.substring(json.indexOf('['));
            json = json.substring(0, json.length - 2);

            try {
                return JSON.parse(json);
            } catch (e) {
                return false;
            }
        },

        getTroopsNonScavengingWorldObj: async function () {
            var troopsObj = {
                villagesTroops: this.initTroops(),
                scavengingTroops: this.initTroops()
            };

            var currentPage = 0;
            var lastRunTime = Date.now();

            await this.setMaxLinesPerPage('overview_villages', 'units', 1000);
            await this.waitMilliseconds(lastRunTime, 200);

            var lastVillageId = null;
            var self = this;

            while (true) {
                lastRunTime = Date.now();

                var overviewTroopsPage = $.parseHTML(
                    this.fetchHtmlPage(this.generateUrl('overview_villages', 'units', { page: currentPage }))
                );

                var troopsTable = $(overviewTroopsPage).find('#units_table tbody');
                var lastVillageIdTemp = $(troopsTable).find('span').eq(0).attr('data-id');

                if (lastVillageId !== null && lastVillageId === lastVillageIdTemp) break;
                lastVillageId = lastVillageIdTemp;

                $.each(troopsTable, function (_, tbodyObj) {
                    var villageTroops = $(tbodyObj).find('tr').eq(0);
                    var villageTroopsLine = $(villageTroops).find('td:gt(1)');
                    var c = 0;

                    $.each(self.availableSupportUnits, function (_, value) {
                        troopsObj.villagesTroops[value] += parseInt(villageTroopsLine.eq(c).text().trim(), 10) || 0;
                        c++;
                    });
                });

                currentPage++;
                await this.waitMilliseconds(lastRunTime, 200);
            }

            return troopsObj;
        },

        setMaxLinesPerPage: async function (screen, mode, value) {
            await new Promise(function (res) { setTimeout(res, 200); });

            var form = document.createElement('form');
            form.method = 'POST';
            form.action = '#';

            $.each({ page_size: value, h: game_data.csrf }, function (key, val) {
                var input = document.createElement('input');
                input.name = key;
                input.value = val;
                form.appendChild(input);
            });

            var dataString = $(form).serialize();
            var url = this.generateUrl(screen, mode, {
                action: 'change_page_size',
                type: 'all'
            });

            $.ajax({
                type: 'POST',
                url: url,
                data: dataString,
                async: false
            });
        },

        getGroupsObj: function () {
            var html = $.parseHTML(
                this.fetchHtmlPage(this.generateUrl('overview_villages', 'groups', { type: 'static' }))
            );

            var groups = $(html).find('.vis_item').find('a,strong');
            var groupsArr = {};

            if ($(groups).length > 0) {
                $.each(groups, function (_, group) {
                    var val = $(group).text().trim();
                    var id = group.getAttribute('data-group-id');
                    if (id) groupsArr[id] = val;
                });
            } else {
                groups = $(html).find('.vis_item select option');
                $.each(groups, function (_, group) {
                    var val = $(group).val();
                    var id = new URLSearchParams(val).get('group');
                    if (id !== null) groupsArr[id] = $(group).text().trim();
                });
            }

            return groupsArr;
        },

        buildTotalTroopsObj: function (troopsObj) {
            var total = {};
            $.each(troopsObj.villagesTroops, function (key, value) {
                total[key] = value + (troopsObj.scavengingTroops[key] || 0);
            });
            return total;
        },

        getCurrentGroupName: function () {
            var groups = this.getGroupsObj();
            return (game_data.group_id && groups[game_data.group_id]) || this.t.noGroup;
        },

        sendToDiscord: function (totalTroops) {
            var validWebhook =
                typeof webhookURL === 'string' &&
                (
                    webhookURL.indexOf('https://discord.com/api/webhooks/') === 0 ||
                    webhookURL.indexOf('https://discordapp.com/api/webhooks/') === 0
                );

            if (!validWebhook) {
                UI.ErrorMessage(this.t.errorMessages.invalidWebhook);
                return;
            }

            var currentGroup = String(this.getCurrentGroupName()).trim();

            var embedData = {
                content: '**Tropa Defensiva (Atualizado em: ' + this.getServerTime() + ')**\n**Jogador:** ' + game_data.player.name,
                embeds: [
                    {
                        title: '🛡️ TROPA DEFENSIVA',
                        color: 3447003,
                        fields: [
                            { name: '🗂️ Grupo Atual', value: currentGroup, inline: false },
                            { name: 'Lanceiros', value: String(totalTroops.spear || 0), inline: true },
                            { name: 'Espadachins', value: String(totalTroops.sword || 0), inline: true },
                            { name: 'Batedores', value: String(totalTroops.spy || 0), inline: true },
                            { name: 'Cavalaria Pesada', value: String(totalTroops.heavy || 0), inline: true },
                            { name: 'Catapultas', value: String(totalTroops.catapult || 0), inline: true },
                            { name: 'Paladinos', value: String(totalTroops.knight || 0), inline: true }
                        ]
                    }
                ]
            };

            $.ajax({
                url: webhookURL,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(embedData),
                success: () => UI.SuccessMessage(this.t.discordSuccess, 3000),
                error: () => UI.ErrorMessage(this.t.discordError)
            });
        },

        getServerTime: function () {
            var serverTime = jQuery('#serverTime').text();
            var serverDate = jQuery('#serverDate').text();
            return serverDate + ' ' + serverTime;
        },

        formatNumber: function (value) {
            return new Intl.NumberFormat('pt-PT').format(Number(value || 0));
        },

        renderUnitGrid: function (troopsObj) {
            var html = '';
            var self = this;

            this.availableSupportUnits.forEach(function (unit) {
                html += ''
                    + '<div class="vtc-unit-card">'
                    + '  <div class="vtc-unit-icon">'
                    + '      <img src="https://dspt.innogamescdn.com/asset/2a2f957f/graphic/unit/unit_' + unit + '.png" alt="' + unit + '">'
                    + '  </div>'
                    + '  <div class="vtc-unit-value">' + self.formatNumber(troopsObj[unit] || 0) + '</div>'
                    + '</div>';
            });

            return html;
        },

        renderSummaryCard: function (label, troopsObj, highlighted) {
            return ''
                + '<div class="vtc-section-card ' + (highlighted ? 'is-highlighted' : '') + '">'
                + '  <div class="vtc-section-title">' + label + '</div>'
                + '  <div class="vtc-unit-grid">' + this.renderUnitGrid(troopsObj) + '</div>'
                + '</div>';
        },

        createUI: async function () {
            UI.InfoMessage(this.t.loadingMessage);

            this.lastTroopsObj = this.isScavengingWorld
                ? await this.getTroopsScavengingWorldObj()
                : await this.getTroopsNonScavengingWorldObj();

            var totalTroops = this.buildTotalTroopsObj(this.lastTroopsObj);
            var currentGroupName = this.getCurrentGroupName();
            var groups = this.getGroupsObj();

            var groupsOptions = Object.entries(groups).map(function (entry) {
                var groupId = entry[0];
                var groupName = entry[1];
                var selected = String(game_data.group_id) === String(groupId) ? 'selected' : '';
                return '<option value="' + groupId + '" ' + selected + '>' + groupName + '</option>';
            }).join('');

            var html = ''
                + '<div id="vtc-root">'
                + '<style>'
                + '#vtc-root{font-family:Arial,sans-serif;color:#e9eef7;min-width:760px;}'
                + '#vtc-root .vtc-shell{background:linear-gradient(180deg,#182131 0%,#101722 100%);border:1px solid #2a3750;border-radius:16px;box-shadow:0 12px 30px rgba(0,0,0,.35);overflow:hidden;}'
                + '#vtc-root .vtc-header{padding:18px 20px 14px;background:linear-gradient(135deg,#24344d 0%,#1c2739 100%);border-bottom:1px solid #31405b;}'
                + '#vtc-root .vtc-title{font-size:22px;font-weight:700;margin:0;color:#fff;}'
                + '#vtc-root .vtc-subtitle{margin-top:6px;font-size:12px;color:#aebcd3;}'
                + '#vtc-root .vtc-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:16px 20px;background:#121b29;border-bottom:1px solid #243146;flex-wrap:wrap;}'
                + '#vtc-root .vtc-meta{display:flex;gap:12px;flex-wrap:wrap;}'
                + '#vtc-root .vtc-badge{background:#1c2738;border:1px solid #2e405b;border-radius:999px;padding:8px 12px;font-size:12px;color:#dce6f7;}'
                + '#vtc-root .vtc-badge strong{color:#fff;}'
                + '#vtc-root .vtc-controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}'
                + '#vtc-root .vtc-select{background:#0f1622;color:#fff;border:1px solid #31425d;border-radius:10px;padding:9px 12px;min-width:220px;outline:none;}'
                + '#vtc-root .vtc-btn{border:0;border-radius:10px;padding:10px 14px;color:#fff;cursor:pointer;font-weight:700;transition:.15s ease;}'
                + '#vtc-root .vtc-btn:hover{transform:translateY(-1px);filter:brightness(1.05);}'
                + '#vtc-root .vtc-btn-primary{background:linear-gradient(135deg,#4a8cff 0%,#2f6fe4 100%);}'
                + '#vtc-root .vtc-btn-secondary{background:linear-gradient(135deg,#2f3d55 0%,#243146 100%);}'
                + '#vtc-root .vtc-content{padding:18px;display:grid;gap:16px;}'
                + '#vtc-root .vtc-section-card{background:linear-gradient(180deg,#182233 0%,#131b28 100%);border:1px solid #2c3a54;border-radius:14px;padding:16px;}'
                + '#vtc-root .vtc-section-card.is-highlighted{border-color:#4a8cff;box-shadow:0 0 0 1px rgba(74,140,255,.15) inset;}'
                + '#vtc-root .vtc-section-title{font-size:15px;font-weight:700;color:#fff;margin-bottom:12px;}'
                + '#vtc-root .vtc-unit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:10px;}'
                + '#vtc-root .vtc-unit-card{background:#0f1622;border:1px solid #24324a;border-radius:12px;padding:10px 8px;text-align:center;}'
                + '#vtc-root .vtc-unit-icon img{width:20px;height:20px;display:block;margin:0 auto 8px;}'
                + '#vtc-root .vtc-unit-value{font-size:14px;font-weight:700;color:#f3f7ff;}'
                + '#vtc-root .vtc-footer{padding:0 20px 18px;color:#8fa3c2;font-size:11px;}'
                + '.popup_box_content{min-width:unset !important;}'
                + '@media (max-width: 820px){#vtc-root{min-width:unset;}#vtc-root .vtc-toolbar{align-items:flex-start;}}'
                + '</style>'

                + '<div class="vtc-shell">'
                + '  <div class="vtc-header">'
                + '      <h3 class="vtc-title">' + this.t.title + '</h3>'
                + '      <div class="vtc-subtitle">' + this.t.subtitle + '</div>'
                + '  </div>'

                + '  <div class="vtc-toolbar">'
                + '      <div class="vtc-meta">'
                + '          <div class="vtc-badge"><strong>' + this.t.group + ':</strong> ' + currentGroupName + '</div>'
                + '          <div class="vtc-badge"><strong>' + this.t.player + ':</strong> ' + game_data.player.name + '</div>'
                + '          <div class="vtc-badge"><strong>' + this.t.server + ':</strong> ' + this.getServerTime() + '</div>'
                + '      </div>'

                + '      <div class="vtc-controls">'
                + '          <select id="vtc-group-select" class="vtc-select">' + groupsOptions + '</select>'
                + '          <button id="vtc-refresh" class="vtc-btn vtc-btn-secondary">' + this.t.refresh + '</button>'
                + '          <button id="vtc-send-discord" class="vtc-btn vtc-btn-primary">' + this.t.sendDiscord + '</button>'
                + '      </div>'
                + '  </div>'

                + '  <div class="vtc-content">'
                +       (this.isScavengingWorld ? this.renderSummaryCard(this.t.home, this.lastTroopsObj.villagesTroops, false) : '')
                +       (this.isScavengingWorld ? this.renderSummaryCard(this.t.scavenging, this.lastTroopsObj.scavengingTroops, false) : '')
                +       this.renderSummaryCard(this.t.total, totalTroops, true)
                + '  </div>'

                + '  <div class="vtc-footer">' + this.t.credits + '</div>'
                + '</div>'
                + '</div>';

            Dialog.show(DIALOG_ID, html);
            $('#popup_box_' + DIALOG_ID).css('width', 'auto');

            $(document).off('click.' + SCRIPT_NS, '#vtc-send-discord');
            $(document).on('click.' + SCRIPT_NS, '#vtc-send-discord', () => {
                this.sendToDiscord(totalTroops);
            });

            $(document).off('click.' + SCRIPT_NS, '#vtc-refresh');
            $(document).on('click.' + SCRIPT_NS, '#vtc-refresh', async () => {
                try { Dialog.close(); } catch (e) {}
                await this.createUI();
            });

            $(document).off('change.' + SCRIPT_NS, '#vtc-group-select');
            $(document).on('change.' + SCRIPT_NS, '#vtc-group-select', async function (ev) {
                var selectedGroup = $(ev.currentTarget).val();
                await VTC.changeGroup(selectedGroup);
            });

            UI.SuccessMessage(this.t.successMessage, 500);
        },

        changeGroup: async function (groupId) {
            this.fetchHtmlPage(this.generateUrl('overview_villages', null, { group: groupId }));
            game_data.group_id = groupId;
            try { Dialog.close(); } catch (e) {}
            await this.createUI();
        }
    };

    window.villagesTroopsCounter = VTC;
    window.villagesTroopsCounter.init();
})();
