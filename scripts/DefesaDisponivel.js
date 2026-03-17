// User Input
if (typeof DEBUG !== 'boolean') DEBUG = false;

// Webhook do Discord
var webhookURL = 'COLOCA_AQUI_O_TEU_WEBHOOK_DISCORD';

var scriptConfig = {
    scriptData: {
        prefix: 'ownHomeTroopsCount',
        name: 'Own Home Troops Count (Home + Scavenging)',
        version: 'v9 nuno logic + discord',
        author: 'RedAlert + edit',
        authorUrl: 'https://twscripts.dev/',
        helpLink: 'https://forum.tribalwars.net/index.php?threads/own-home-troops-count.286618/'
    },

    translations: {
        pt_PT: {
            'Own Home Troops Count': 'Contagem de Tropa (Casa + Buscas)',
            'Offensive Troops': 'Tropas de Ataque',
            'Defensive Troops': 'Tropas Defensivas',
            'Export Troop Counts': 'Exportar Contagem de Tropas',
            'There was an error!': 'Ocorreu um erro inesperado!',
            'Premium Account is required for this script to run!':
                'É necessário ter conta Premium para usar este script!',
            'Redirecting...': 'Redirecionando...',
            Help: 'Ajuda'
        }
    },

    allowedMarkets: [],
    allowedScreens: ['overview_villages'],
    allowedModes: ['combined'],
    isDebug: DEBUG,
    enableCountApi: true
};

$.getScript(
    `https://twscripts.dev/scripts/twSDK.js?url=${document.currentScript.src}`,
    async function () {
        await twSDK.init(scriptConfig);

        $('<style>').prop('type', 'text/css').html(`
            #sendToDiscord.btn-twf {
                display: block;
                transition: transform 0.2s, box-shadow 0.2s;
                margin: 20px auto;
                padding: 8px 16px;
                background: linear-gradient(to bottom, #f2e5b6 0%, #d6c58a 100%);
                border: 1px solid #b59e4c;
                border-radius: 6px;
                color: #383020;
                font-weight: bold;
                font-size: 14px;
                border-image: linear-gradient(45deg, #d6c58a, #f2e5b6) 1;
                text-shadow: 0 1px 0 rgba(255,255,255,0.6);
                cursor: pointer;
            }

            #sendToDiscord.btn-twf:active {
                transform: translateY(0);
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }

            #sendToDiscord.btn-twf:hover {
                background: linear-gradient(to bottom, #e7d49f 0%, #c9b16f 100%);
                transform: translateY(-2px);
                border-image-width: 2;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
        `).appendTo('head');

        const isValidScreen = twSDK.checkValidLocation('screen');
        const isValidMode = twSDK.checkValidLocation('mode');

        (async function () {
            try {
                if (game_data.features.Premium.active) {
                    if (isValidScreen && isValidMode) {
                        await buildUI();
                    } else {
                        UI.InfoMessage('Redirecionando...');
                        twSDK.redirectTo('overview_villages&mode=combined');
                    }
                } else {
                    UI.ErrorMessage('É necessário ter conta Premium para usar este script!');
                }
            } catch (error) {
                UI.ErrorMessage('Ocorreu um erro inesperado!');
                console.error(error);
            }
        })();

        async function buildUI() {
            const troopsObj = await getTroopsObject();
            const totalCombined = mergeTroops(
                troopsObj.villagesTroops,
                troopsObj.scavengingTroops
            );

            const bbCode = getTroopsBBCode(totalCombined);
            const content = prepareContent(totalCombined, bbCode);

            twSDK.renderBoxWidget(
                content,
                scriptConfig.scriptData.prefix,
                'ra-own-home-troops-count'
            );

            jQuery('#sendToDiscord').remove();
            jQuery('.ra-own-home-troops-count').append(`
                <button id="sendToDiscord" class="btn-twf">
                    Partilhar defesa disponível no ticket
                </button>
            `);

            jQuery('#sendToDiscord').on('click', () => {
                sendDefensiveTroopsToDiscord(totalCombined);
            });

            setTimeout(() => {
                if (!game_data.units.includes('archer')) {
                    jQuery('.archer-world').hide();
                }

                if (!game_data.units.includes('knight')) {
                    jQuery('.paladin-world').hide();
                }
            }, 100);
        }

        function initTroops() {
            const troops = {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 0,
                spy: 0,
                light: 0,
                marcher: 0,
                heavy: 0,
                ram: 0,
                catapult: 0,
                knight: 0,
                snob: 0
            };

            if (!game_data.units.includes('archer')) {
                delete troops.archer;
                delete troops.marcher;
            }

            if (!game_data.units.includes('knight')) {
                delete troops.knight;
            }

            return troops;
        }

        async function getTroopsObject() {
            const isScavengingWorld = await checkScavengingWorld();

            if (isScavengingWorld) {
                return await getTroopsScavengingWorldObj();
            }

            return getTroopsNonScavengingWorldObj();
        }

        async function checkScavengingWorld() {
            try {
                const configXml = await jQuery.get('/interface.php?func=get_config');
                const xml = jQuery.parseXML(configXml);
                const scavengingNode = xml.getElementsByTagName('config')[0]
                    .getElementsByTagName('game')[0]
                    .getElementsByTagName('scavenging')[0];

                return scavengingNode && scavengingNode.textContent.trim() === '1';
            } catch (e) {
                console.error('Erro ao verificar se o mundo tem buscas:', e);
                return false;
            }
        }

        async function getTroopsScavengingWorldObj() {
            const troopsObj = {
                villagesTroops: initTroops(),
                scavengingTroops: initTroops()
            };

            let currentPage = 0;
            let lastRunTime = null;

            do {
                const scavengingObject = await getScavengeMassScreenJson(currentPage, lastRunTime);

                if (!scavengingObject) {
                    return troopsObj;
                }

                if (scavengingObject.length === 0) {
                    break;
                }

                lastRunTime = Date.now();

                jQuery.each(scavengingObject, function (_, villageData) {
                    jQuery.each(villageData.unit_counts_home || {}, function (key, value) {
                        if (key !== 'militia' && Object.prototype.hasOwnProperty.call(troopsObj.villagesTroops, key)) {
                            troopsObj.villagesTroops[key] += parseInt(value, 10) || 0;
                        }
                    });

                    jQuery.each(villageData.options || {}, function (_, option) {
                        if (option.scavenging_squad !== null && option.scavenging_squad && option.scavenging_squad.unit_counts) {
                            jQuery.each(option.scavenging_squad.unit_counts, function (key, value) {
                                if (key !== 'militia' && Object.prototype.hasOwnProperty.call(troopsObj.scavengingTroops, key)) {
                                    troopsObj.scavengingTroops[key] += parseInt(value, 10) || 0;
                                }
                            });
                        }
                    });
                });

                currentPage++;
            } while (true);

            return troopsObj;
        }

        async function getScavengeMassScreenJson(currentPage = 0, lastRunTime = 0) {
            await waitMilliseconds(lastRunTime, 200);

            let url = `/game.php?village=${game_data.village.id}&screen=place&mode=scavenge_mass&page=${currentPage}`;
            if (game_data.player.sitter !== "0") {
                url += `&t=${game_data.player.id}`;
            }

            try {
                const html = await jQuery.get(url);
                let matches = html.match(/ScavengeMassScreen[\s\S]*?(,\n *\[.*?\}{0,3}\],\n)/);

                if (!matches || matches.length <= 1) {
                    return false;
                }

                matches = matches[1];
                matches = matches.substring(matches.indexOf('['));
                matches = matches.substring(0, matches.length - 2);

                return JSON.parse(matches);
            } catch (e) {
                console.error('Erro ao carregar scavenge_mass:', e);
                return false;
            }
        }

        function getTroopsNonScavengingWorldObj() {
            const troopsObj = {
                villagesTroops: initTroops(),
                scavengingTroops: initTroops()
            };

            const homeTroops = collectTroopsAtHome();

            homeTroops.forEach(obj => {
                Object.keys(troopsObj.villagesTroops).forEach(unit => {
                    troopsObj.villagesTroops[unit] += obj[unit] || 0;
                });
            });

            return troopsObj;
        }

        async function waitMilliseconds(lastRunTime, milliseconds = 0) {
            await new Promise(resolve =>
                setTimeout(resolve, Math.max((lastRunTime || 0) + milliseconds - Date.now(), 0))
            );
        }

        function prepareContent(totalTroops, bbCode) {
            const {
                spear = 0, sword = 0, axe = 0, archer = 0, spy = 0,
                light = 0, marcher = 0, heavy = 0, ram = 0,
                catapult = 0, knight = 0, snob = 0
            } = totalTroops;

            return `
                <div class="ra-mb15">
                    <h4>Tropas de Ataque</h4>
                    <table width="100%" class="ra-table">
                        <thead>
                            <tr>
                                <th><img src="/graphic/unit/unit_axe.webp"></th>
                                <th><img src="/graphic/unit/unit_light.webp"></th>
                                <th class="archer-world"><img src="/graphic/unit/unit_marcher.webp"></th>
                                <th><img src="/graphic/unit/unit_ram.webp"></th>
                                <th><img src="/graphic/unit/unit_catapult.webp"></th>
                                <th class="paladin-world"><img src="/graphic/unit/unit_knight.webp"></th>
                                <th><img src="/graphic/unit/unit_snob.webp"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${twSDK.formatAsNumber(axe)}</td>
                                <td>${twSDK.formatAsNumber(light)}</td>
                                <td class="archer-world">${twSDK.formatAsNumber(marcher)}</td>
                                <td>${twSDK.formatAsNumber(ram)}</td>
                                <td>${twSDK.formatAsNumber(catapult)}</td>
                                <td class="paladin-world">${twSDK.formatAsNumber(knight)}</td>
                                <td>${twSDK.formatAsNumber(snob)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="ra-mb15">
                    <h4>Tropas Defensivas</h4>
                    <table width="100%" class="ra-table">
                        <thead>
                            <tr>
                                <th><img src="/graphic/unit/unit_spear.webp"></th>
                                <th><img src="/graphic/unit/unit_sword.webp"></th>
                                <th class="archer-world"><img src="/graphic/unit/unit_archer.webp"></th>
                                <th><img src="/graphic/unit/unit_spy.webp"></th>
                                <th><img src="/graphic/unit/unit_heavy.webp"></th>
                                <th><img src="/graphic/unit/unit_catapult.webp"></th>
                                <th class="paladin-world"><img src="/graphic/unit/unit_knight.webp"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>${twSDK.formatAsNumber(spear)}</td>
                                <td>${twSDK.formatAsNumber(sword)}</td>
                                <td class="archer-world">${twSDK.formatAsNumber(archer)}</td>
                                <td>${twSDK.formatAsNumber(spy)}</td>
                                <td>${twSDK.formatAsNumber(heavy)}</td>
                                <td>${twSDK.formatAsNumber(catapult)}</td>
                                <td class="paladin-world">${twSDK.formatAsNumber(knight)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div>
                    <h4>Exportar Contagem de Tropas</h4>
                    <textarea readonly class="ra-textarea">${bbCode.trim()}</textarea>
                </div>
            `;
        }

        function collectTroopsAtHome() {
            const rows = jQuery('#combined_table tr.nowrap');
            const header = [];
            const homeTroops = [];

            jQuery('#combined_table tr:eq(0) th').each(function () {
                const img = jQuery(this).find('img').attr('src');
                if (img) {
                    let name = img.split('/').pop().replace('.webp', '');
                    header.push(name);
                } else {
                    header.push(null);
                }
            });

            rows.each(function () {
                const rowTroops = {};
                header.forEach((h, index) => {
                    if (h && h.includes('unit_')) {
                        const unit = h.replace('unit_', '');
                        const value = jQuery(this).find(`td:eq(${index})`).text().replace(/\./g, '');
                        rowTroops[unit] = parseInt(value || '0', 10);
                    }
                });
                homeTroops.push(rowTroops);
            });

            return homeTroops;
        }

        function mergeTroops(home, scavenge) {
            const merged = {};
            const keys = new Set([...Object.keys(home), ...Object.keys(scavenge)]);

            keys.forEach(k => {
                merged[k] = (home[k] || 0) + (scavenge[k] || 0);
            });

            return merged;
        }

        function getTroopsBBCode(totalTroops) {
            let currentGroup = (jQuery('strong.group-menu-item').text() || 'todos').trim();
            currentGroup = currentGroup.replace(/^>/, '').replace(/<$/, '').trim();

            let bbCode = `[b]Contagem de Tropas em Casa + Buscas (${getServerTime()})[/b]\n`;
            bbCode += `[b]Grupo Atual:[/b] ${currentGroup}\n\n`;

            Object.entries(totalTroops).forEach(([unit, value]) => {
                bbCode += `[unit]${unit}[/unit] [b]${twSDK.formatAsNumber(value)}[/b] ${getUnitLabel(unit)}\n`;
            });

            return bbCode;
        }

        function sendDefensiveTroopsToDiscord(totalCombined) {
            const playerName = game_data.player.name;
            let currentGroup = (jQuery('strong.group-menu-item').text() || 'todos').trim();
            currentGroup = currentGroup.replace(/^>/, '').replace(/<$/, '').trim();

            if (
                typeof webhookURL !== 'string' ||
                !webhookURL.startsWith('https://discord.com/api/webhooks/')
            ) {
                UI.ErrorMessage('Webhook inválido ou não definido.');
                return;
            }

            const embedData = {
                content: `**Tropa Defensiva (Atualizado em: ${getServerTime()})**\n**Jogador:** ${playerName}`,
                embeds: [
                    {
                        title: '**🛡️ TROPA DEFENSIVA**',
                        fields: [
                            {
                                name: '🗂️ **Grupo Atual**',
                                value: currentGroup || 'todos',
                                inline: false
                            },
                            {
                                name: '<:lanceiro:1368839513891409972> **Lanceiros**',
                                value: `${totalCombined.spear || 0}`,
                                inline: true
                            },
                            {
                                name: '<:espadachim:1368839514746785844> **Espadachins**',
                                value: `${totalCombined.sword || 0}`,
                                inline: true
                            },
                            {
                                name: '<:batedor:1368839512423137404> **Batedores**',
                                value: `${totalCombined.spy || 0}`,
                                inline: true
                            },
                            {
                                name: '<:pesada:1368839517997498398> **Cavalaria Pesada**',
                                value: `${totalCombined.heavy || 0}`,
                                inline: true
                            },
                            {
                                name: '<:catapulta:1368839516441280573> **Catapultas**',
                                value: `${totalCombined.catapult || 0}`,
                                inline: true
                            },
                            {
                                name: '<:paladino:1368332901728391319> **Paladinos**',
                                value: `${totalCombined.knight || 0}`,
                                inline: true
                            }
                        ]
                    }
                ]
            };

            jQuery.ajax({
                url: webhookURL,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(embedData),
                success: function () {
                    UI.SuccessMessage('Defesa partilhada com sucesso!', 3000);
                },
                error: function () {
                    UI.ErrorMessage('Erro ao enviar para o Discord.');
                }
            });
        }

        function getServerTime() {
            return jQuery('#serverDate').text() + ' ' + jQuery('#serverTime').text();
        }

        function getUnitLabel(key) {
            const labels = {
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

            return labels[key] || '';
        }
    }
);
