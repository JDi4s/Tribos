// User Input
if (typeof DEBUG !== 'boolean') DEBUG = false;

// --- NÃO há webhook/token aqui ---
// Se quiseres enviar para Discord depois, define:
// var webhookURL = 'https://discord.com/api/webhooks/...';

var scriptConfig = {
    scriptData: {
        prefix: 'ownHomeTroopsCount',
        name: 'Own Home Troops Count (Home + Scavenging)',
        version: 'v7 ajax scavenging fix',
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
            const homeTroops = collectTroopsAtHome();
            const totalHome = getTotalHomeTroops(homeTroops);

            const scavengingTroops = await getScavengingTroops();
            const totalCombined = mergeTroops(totalHome, scavengingTroops);

            const bbCode = getTroopsBBCode(totalCombined);
            const content = prepareContent(totalCombined, bbCode);

            twSDK.renderBoxWidget(
                content,
                scriptConfig.scriptData.prefix,
                'ra-own-home-troops-count'
            );

            setTimeout(() => {
                if (!game_data.units.includes('archer')) {
                    jQuery('.archer-world').hide();
                }

                if (!game_data.units.includes('knight')) {
                    jQuery('.paladin-world').hide();
                }
            }, 100);
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

        function getTotalHomeTroops(homeTroops) {
            const totals = {
                spear: 0, sword: 0, axe: 0, archer: 0, spy: 0, light: 0,
                marcher: 0, heavy: 0, ram: 0, catapult: 0, knight: 0, snob: 0
            };

            homeTroops.forEach(obj => {
                Object.keys(totals).forEach(unit => {
                    totals[unit] += obj[unit] || 0;
                });
            });

            if (!game_data.units.includes('archer')) {
                delete totals.archer;
                delete totals.marcher;
            }

            if (!game_data.units.includes('knight')) {
                delete totals.knight;
            }

            return totals;
        }

        async function getScavengingTroops() {
            const troops = {
                spear: 0, sword: 0, axe: 0, archer: 0, spy: 0,
                light: 0, marcher: 0, heavy: 0, ram: 0,
                catapult: 0, knight: 0, snob: 0
            };

            let page = 0;

            while (true) {
                try {
                    let url = `/game.php?village=${game_data.village.id}&screen=place&mode=scavenge_mass&page=${page}`;
                    if (game_data.player.sitter !== "0") {
                        url += `&t=${game_data.player.id}`;
                    }

                    const html = await jQuery.get(url);

                    const match = html.match(/ScavengeMassScreen[\s\S]*?(,\n *\[.*?\],\n)/);
                    if (!match) {
                        break;
                    }

                    let json = match[1];
                    json = json.substring(json.indexOf('['));
                    json = json.slice(0, -2);

                    const data = JSON.parse(json);
                    if (!data.length) {
                        break;
                    }

                    data.forEach(village => {
                        if (!village.options) return;

                        village.options.forEach(option => {
                            if (!option.scavenging_squad) return;
                            if (!option.scavenging_squad.unit_counts) return;

                            Object.entries(option.scavenging_squad.unit_counts).forEach(([unit, value]) => {
                                if (Object.prototype.hasOwnProperty.call(troops, unit)) {
                                    troops[unit] += parseInt(value, 10) || 0;
                                }
                            });
                        });
                    });

                    page++;
                    await new Promise(resolve => setTimeout(resolve, 200));
                } catch (e) {
                    console.error('Erro a ler buscas:', e);
                    break;
                }
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
