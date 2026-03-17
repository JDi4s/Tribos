// User Input
if (typeof DEBUG !== 'boolean') DEBUG = false;

// Script Config
var scriptConfig = {
    scriptData: {
        prefix: 'ownHomeTroopsCount',
        name: 'Own Home Troops Count',
        version: 'v2 + scavenging total',
        author: 'RedAlert + edit',
        authorUrl: 'https://twscripts.dev/',
        helpLink: 'https://forum.tribalwars.net/index.php?threads/own-home-troops-count.286618/'
    },

    translations: {
        pt_PT: {
            'Own Home Troops Count': 'Contagem de Tropa em Casa',
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

            #sendToDiscord.btn-twf img {
                max-width: 36px;
                max-height: 36px;
                width: auto;
                height: auto;
                vertical-align: middle;
                margin-right: 8px;
            }
        `).appendTo('head');

        const scriptInfo = twSDK.scriptInfo();
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
                console.error(`${scriptInfo} Error:`, error);
            }
        })();

        async function buildUI() {
            const homeTroops = collectTroopsAtHome();
            const totalTroopsAtHome = getTotalHomeTroops(homeTroops);

            const scavengingTroops = await getScavengingTroops();
            const totalTroopsCombined = mergeTroops(totalTroopsAtHome, scavengingTroops);

            const bbCode = getTroopsBBCode(totalTroopsCombined);
            const content = prepareContent(totalTroopsCombined, bbCode);

            twSDK.renderBoxWidget(
                content,
                scriptConfig.scriptData.prefix,
                'ra-own-home-troops-count'
            );

            const discordButton = `
                <button id="sendToDiscord" class="btn-twf">
                    Partilhar defesa disponível no ticket
                </button>
            `;

            jQuery('#sendToDiscord').remove();
            jQuery('.ra-own-home-troops-count').append(discordButton);

            jQuery('#sendToDiscord').on('click', () => {
                sendDefensiveTroopsToDiscord(totalTroopsCombined);
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

        function sendDefensiveTroopsToDiscord(totalTroopsCombined) {
            const playerName = game_data.player.name;
            const currentGroup = jQuery('strong.group-menu-item').text();

            if (
                typeof webhookURL !== 'string' ||
                !webhookURL.startsWith('https://discord.com/api/webhooks/')
            ) {
                alert('❌ Webhook inválido ou não definido.');
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
                                value: currentGroup || 'Todos',
                                inline: false
                            },
                            {
                                name: '<:lanceiro:1368839513891409972> **Lanceiros**',
                                value: `${totalTroopsCombined.spear || 0}`,
                                inline: true
                            },
                            {
                                name: '<:espadachim:1368839514746785844> **Espadachins**',
                                value: `${totalTroopsCombined.sword || 0}`,
                                inline: true
                            },
                            {
                                name: '<:batedor:1368839512423137404> **Batedores**',
                                value: `${totalTroopsCombined.spy || 0}`,
                                inline: true
                            },
                            {
                                name: '<:pesada:1368839517997498398> **Cavalaria Pesada**',
                                value: `${totalTroopsCombined.heavy || 0}`,
                                inline: true
                            },
                            {
                                name: '<:catapulta:1368839516441280573> **Catapultas**',
                                value: `${totalTroopsCombined.catapult || 0}`,
                                inline: true
                            },
                            {
                                name: '<:paladino:1368332901728391319> **Paladinos**',
                                value: `${totalTroopsCombined.knight || 0}`,
                                inline: true
                            }
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
                    alert('Defesa compartilhada com a liderança!');
                },
                error: function () {
                    alert('Houve um erro ao enviar os dados para o Discord.');
                }
            });
        }

        function prepareContent(totalTroops, bbCode) {
            const {
                spear = 0,
                sword = 0,
                axe = 0,
                archer = 0,
                spy = 0,
                light = 0,
                marcher = 0,
                heavy = 0,
                ram = 0,
                catapult = 0,
                knight = 0,
                snob = 0
            } = totalTroops;

            return `
                <div class="ra-mb15">
                    <h4>Tropas de Ataque</h4>
                    <table width="100%" class="ra-table">
                        <thead>
                            <tr>
                                <th width="14.2%"><img src="/graphic/unit/unit_axe.webp"></th>
                                <th width="14.2%"><img src="/graphic/unit/unit_light.webp"></th>
                                <th width="14.2%" class="archer-world"><img src="/graphic/unit/unit_marcher.webp"></th>
                                <th width="14.2%"><img src="/graphic/unit/unit_ram.webp"></th>
                                <th width="14.2%"><img src="/graphic/unit/unit_catapult.webp"></th>
                                <th width="14.2%" class="paladin-world"><img src="/graphic/unit/unit_knight.webp"></th>
                                <th width="14.2%"><img src="/graphic/unit/unit_snob.webp"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td width="14.2%">${twSDK.formatAsNumber(axe)}</td>
                                <td width="14.2%">${twSDK.formatAsNumber(light)}</td>
                                <td width="14.2%" class="archer-world">${twSDK.formatAsNumber(marcher)}</td>
                                <td width="14.2%">${twSDK.formatAsNumber(ram)}</td>
                                <td width="14.2%">${twSDK.formatAsNumber(catapult)}</td>
                                <td width="14.2%" class="paladin-world">${twSDK.formatAsNumber(knight)}</td>
                                <td width="14.2%">${twSDK.formatAsNumber(snob)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="ra-mb15">
                    <h4>Tropas Defensivas</h4>
                    <table width="100%" class="ra-table">
                        <thead>
                            <tr>
                                <th width="14.2%"><img src="/graphic/unit/unit_spear.webp"></th>
                                <th width="14.2%"><img src="/graphic/unit/unit_sword.webp"></th>
                                <th width="14.2%" class="archer-world"><img src="/graphic/unit/unit_archer.webp"></th>
                                <th width="14.2%"><img src="/graphic/unit/unit_spy.webp"></th>
                                <th width="14.2%"><img src="/graphic/unit/unit_heavy.webp"></th>
                                <th width="14.2%"><img src="/graphic/unit/unit_catapult.webp"></th>
                                <th width="14.2%" class="paladin-world"><img src="/graphic/unit/unit_knight.webp"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td width="14.2%">${twSDK.formatAsNumber(spear)}</td>
                                <td width="14.2%">${twSDK.formatAsNumber(sword)}</td>
                                <td width="14.2%" class="archer-world">${twSDK.formatAsNumber(archer)}</td>
                                <td width="14.2%">${twSDK.formatAsNumber(spy)}</td>
                                <td width="14.2%">${twSDK.formatAsNumber(heavy)}</td>
                                <td width="14.2%">${twSDK.formatAsNumber(catapult)}</td>
                                <td width="14.2%" class="paladin-world">${twSDK.formatAsNumber(knight)}</td>
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
            const combinedTableRows = jQuery('#combined_table tr.nowrap');
            let homeTroops = [];
            let combinedTableHeader = [];

            jQuery('#combined_table tr:eq(0) th').each(function () {
                const thImage = jQuery(this).find('img').attr('src');

                if (thImage) {
                    let thImageFilename = thImage.split('/').pop();
                    thImageFilename = thImageFilename.replace('.webp', '');
                    combinedTableHeader.push(thImageFilename);
                } else {
                    combinedTableHeader.push(null);
                }
            });

            combinedTableRows.each(function () {
                let rowTroops = {};

                combinedTableHeader.forEach((tableHeader, index) => {
                    if (tableHeader && tableHeader.includes('unit_')) {
                        const unitType = tableHeader.replace('unit_', '');
                        const textValue = jQuery(this).find(`td:eq(${index})`).text().trim();
                        rowTroops[unitType] = parseInt(textValue || '0', 10) || 0;
                    }
                });

                homeTroops.push(rowTroops);
            });

            return homeTroops;
        }

        function getTotalHomeTroops(homeTroops) {
            let totalTroopsAtHome = {
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

            for (const obj of homeTroops) {
                totalTroopsAtHome.spear += obj.spear || 0;
                totalTroopsAtHome.sword += obj.sword || 0;
                totalTroopsAtHome.axe += obj.axe || 0;
                totalTroopsAtHome.archer += obj.archer || 0;
                totalTroopsAtHome.spy += obj.spy || 0;
                totalTroopsAtHome.light += obj.light || 0;
                totalTroopsAtHome.marcher += obj.marcher || 0;
                totalTroopsAtHome.heavy += obj.heavy || 0;
                totalTroopsAtHome.ram += obj.ram || 0;
                totalTroopsAtHome.catapult += obj.catapult || 0;
                totalTroopsAtHome.knight += obj.knight || 0;
                totalTroopsAtHome.snob += obj.snob || 0;
            }

            if (!game_data.units.includes('archer')) {
                delete totalTroopsAtHome.archer;
                delete totalTroopsAtHome.marcher;
            }

            if (!game_data.units.includes('knight')) {
                delete totalTroopsAtHome.knight;
            }

            return totalTroopsAtHome;
        }

        async function getScavengingTroops() {
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

            const hasScavenging = await isScavengingEnabled();
            if (!hasScavenging) {
                if (!game_data.units.includes('archer')) {
                    delete troops.archer;
                    delete troops.marcher;
                }
                if (!game_data.units.includes('knight')) {
                    delete troops.knight;
                }
                return troops;
            }

            let currentPage = 0;

            while (true) {
                const url = `/game.php?village=${game_data.village.id}&screen=place&mode=scavenge_mass&page=${currentPage}${game_data.player.sitter !== "0" ? "&t=" + game_data.player.id : ""}`;
                const html = await fetchPage(url);

                const matches = html.match(/ScavengeMassScreen[\s\S]*?(,\n *\[.*?\}{0,3}\],\n)/);

                if (!matches || matches.length <= 1) {
                    break;
                }

                let jsonText = matches[1];
                jsonText = jsonText.substring(jsonText.indexOf('['));
                jsonText = jsonText.substring(0, jsonText.length - 2);

                let scavengingObject = [];
                try {
                    scavengingObject = JSON.parse(jsonText);
                } catch (e) {
                    console.error('Erro ao interpretar dados das buscas:', e);
                    break;
                }

                if (!scavengingObject.length) {
                    break;
                }

                jQuery.each(scavengingObject, function (_, villageData) {
                    if (!villageData.options) return;

                    jQuery.each(villageData.options, function (_, option) {
                        if (option.scavenging_squad && option.scavenging_squad.unit_counts) {
                            jQuery.each(option.scavenging_squad.unit_counts, function (key, value) {
                                if (key !== 'militia' && Object.prototype.hasOwnProperty.call(troops, key)) {
                                    troops[key] += parseInt(value, 10) || 0;
                                }
                            });
                        }
                    });
                });

                currentPage++;
                await sleep(200);
            }

            if (!game_data.units.includes('archer')) {
                delete troops.archer;
                delete troops.marcher;
            }

            if (!game_data.units.includes('knight')) {
                delete troops.knight;
            }

            return troops;
        }

        function mergeTroops(homeTroops, scavengingTroops) {
            const merged = {};
            const allKeys = new Set([
                ...Object.keys(homeTroops),
                ...Object.keys(scavengingTroops)
            ]);

            allKeys.forEach((key) => {
                merged[key] = (homeTroops[key] || 0) + (scavengingTroops[key] || 0);
            });

            return merged;
        }

        async function isScavengingEnabled() {
            try {
                const storageKey = `worldConfigFile_${game_data.world}`;
                let worldConfig = localStorage.getItem(storageKey);

                if (!worldConfig) {
                    worldConfig = await fetchPage('/interface.php?func=get_config');
                    localStorage.setItem(storageKey, worldConfig);
                }

                const xml = jQuery.parseXML(worldConfig);
                const scavengingNode = xml.getElementsByTagName('config')[0]
                    .getElementsByTagName('game')[0]
                    .getElementsByTagName('scavenging')[0];

                return scavengingNode && scavengingNode.textContent.trim() === '1';
            } catch (e) {
                console.error('Erro ao verificar buscas:', e);
                return false;
            }
        }

        function fetchPage(url) {
            return new Promise((resolve, reject) => {
                jQuery.ajax({
                    url: url,
                    type: 'GET',
                    success: function (data) {
                        resolve(data);
                    },
                    error: function (xhr, status, error) {
                        reject(error);
                    }
                });
            });
        }

        function sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        function getTroopsBBCode(totalTroops) {
            const currentGroup = jQuery('strong.group-menu-item').text();
            let bbCode = `[b]Contagem de Tropas em Casa + Buscas (${getServerTime()})[/b]\n`;
            bbCode += `[b]Grupo Atual:[/b] ${currentGroup}\n\n`;

            for (let [key, value] of Object.entries(totalTroops)) {
                bbCode += `[unit]${key}[/unit] [b]${twSDK.formatAsNumber(value)}[/b] ${getUnitLabel(key)}\n`;
            }

            return bbCode;
        }

        function getServerTime() {
            const serverTime = jQuery('#serverTime').text();
            const serverDate = jQuery('#serverDate').text();
            return serverDate + ' ' + serverTime;
        }

        function getUnitLabel(key) {
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
    }
);
