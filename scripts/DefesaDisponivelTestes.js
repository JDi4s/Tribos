/* * Script: Own Home Troops Count + Offensive State
 * Autor: RedAlert (Base) & Gemini (Refinement)
 * Modo: Visualização Combinado
 */

if (typeof DEBUG !== 'boolean') DEBUG = false;

var scriptConfig = {
  scriptData: {
    prefix: 'ownHomeTroopsCount',
    name:   'Own Home Troops Count & Nukes',
    version:'v3.0 (Offensive Update)',
    author: 'RedAlert',
    authorUrl: 'https://twscripts.dev/',
    helpLink:  'https://forum.tribalwars.net/index.php?threads/own-home-troops-count.286618/'
  },
  translations: {
    pt_PT: {
      'Own Home Troops Count': 'Contagem de Tropa e Nukes',
      'Redirecting...': 'A redirecionar...',
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
        
        $('<style>').prop('type','text/css').html(`
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
                cursor: pointer;
            }
            #sendToDiscord.btn-twf:hover {
                background: linear-gradient(to bottom, #e7d49f 0%, #c9b16f 100%);
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            #sendToDiscord.btn-twf img {
                max-width: 20px;
                vertical-align: middle;
                margin-right: 8px;
            }
            .nuke-badge {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 4px;
                color: #fff;
                font-weight: bold;
                font-size: 0.9em;
            }
            .bg-full { background: #8b0000; }
            .bg-semi { background: #cd5c5c; }
            .bg-rec { background: #777; }
        `).appendTo('head');

        (function () {
            try {
                if (game_data.features.Premium.active) {
                    if (twSDK.checkValidLocation('screen') && twSDK.checkValidLocation('mode')) {
                        buildUI();
                    } else {
                        UI.InfoMessage('A redirecionar...');
                        twSDK.redirectTo('overview_villages&mode=combined');
                    }
                } else {
                    UI.ErrorMessage('Necessário Conta Premium!');
                }
            } catch (e) { console.error(e); }
        })();

        function buildUI() {
            const homeTroops = collectTroopsAtHome();
            const totalTroopsAtHome = getTotalHomeTroops(homeTroops);
            const nukeStatus = calculateNukeStatus(homeTroops);
            const bbCode = getTroopsBBCode(totalTroopsAtHome, nukeStatus);
            
            const content = prepareContent(totalTroopsAtHome, nukeStatus, bbCode);

            twSDK.renderBoxWidget(content, scriptConfig.scriptData.prefix, 'ra-own-home-troops-count');

            jQuery('#sendToDiscord').remove();
            jQuery('.ra-own-home-troops-count').append(`
                <button id="sendToDiscord" class="btn-twf">
                    <img src="https://i.imgur.com/8n7jRL9.png"> Partilhar Dados no Ticket
                </button>
            `);

            jQuery('#sendToDiscord').on('click', () => {
                sendToDiscord(totalTroopsAtHome, nukeStatus);
            });

            if (!game_data.units.includes('archer')) jQuery('.archer-world').hide();
            if (!game_data.units.includes('knight')) jQuery('.paladin-world').hide();
        }

        function calculateNukeStatus(homeTroops) {
            let status = { full: 0, semi: 0, rebuilding: 0 };
            homeTroops.forEach(v => {
                // Cálculo de pop ofensiva (Machados, Leve, Arq. Montados, Aríetes, Catas)
                let pop = (v.axe * 1) + (v.light * 4) + ((v.marcher || 0) * 5) + (v.ram * 5) + (v.catapult * 8);
                if (pop >= 19000) status.full++;
                else if (pop >= 10000) status.semi++;
                else if (pop >= 2000) status.rebuilding++;
            });
            return status;
        }

        function sendToDiscord(total, nuke) {
            if (typeof webhookURL === 'undefined') {
                alert("Erro: Link do Discord não encontrado na Quickbar!");
                return;
            }

            const embedData = {
                content: `**Resumo de Conta - ${game_data.player.name}**\nData: ${getServerTime()}`,
                embeds: [{
                    title: "🛡️ DEFESA DISPONÍVEL",
                    color: 3066993,
                    fields: [
                        { name: "Lanceiros", value: `${twSDK.formatAsNumber(total.spear)}`, inline: true },
                        { name: "Espadachins", value: `${twSDK.formatAsNumber(total.sword)}`, inline: true },
                        { name: "C. Pesada", value: `${twSDK.formatAsNumber(total.heavy)}`, inline: true }
                    ]
                },
                {
                    title: "⚔️ ESTADO DOS NUKES (Aldeias)",
                    color: 15158332,
                    fields: [
                        { name: "🚀 Fulls (19k+)", value: `${nuke.full}`, inline: true },
                        { name: "📈 Semis (10k+)", value: `${nuke.semi}`, inline: true },
                        { name: "🛠️ Recrutar", value: `${nuke.rebuilding}`, inline: true }
                    ]
                }]
            };

            $.ajax({
                url: webhookURL,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(embedData),
                success: () => UI.SuccessMessage("Enviado com sucesso!"),
                error: () => UI.ErrorMessage("Erro ao enviar para o Discord.")
            });
        }

        function prepareContent(total, nuke, bbCode) {
            return `
                <div class="ra-mb15">
                    <h4>Estado de Ataque (Aldeias)</h4>
                    <div style="display:flex; justify-content: space-around; background: #f4e4bc; padding: 10px; border-radius: 5px; border: 1px solid #d2c29d;">
                        <div style="text-align:center">🚀 <br><b>${nuke.full}</b><br><span class="nuke-badge bg-full">Fulls</span></div>
                        <div style="text-align:center">📈 <br><b>${nuke.semi}</b><br><span class="nuke-badge bg-semi">Semis</span></div>
                        <div style="text-align:center">🛠️ <br><b>${nuke.rebuilding}</b><br><span class="nuke-badge bg-rec">A Recrutar</span></div>
                    </div>
                </div>
                <div class="ra-mb15">
                    <h4>Tropa Defensiva Total</h4>
                    <table width="100%" class="ra-table">
                        <thead>
                            <tr>
                                <th><img src="/graphic/unit/unit_spear.webp"></th>
                                <th><img src="/graphic/unit/unit_sword.webp"></th>
                                <th class="archer-world"><img src="/graphic/unit/unit_archer.webp"></th>
                                <th><img src="/graphic/unit/unit_heavy.webp"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr style="text-align:center">
                                <td>${twSDK.formatAsNumber(total.spear)}</td>
                                <td>${twSDK.formatAsNumber(total.sword)}</td>
                                <td class="archer-world">${twSDK.formatAsNumber(total.archer)}</td>
                                <td>${twSDK.formatAsNumber(total.heavy)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <textarea readonly class="ra-textarea" style="height:60px;">${bbCode.trim()}</textarea>
            `;
        }

        function collectTroopsAtHome() {
            const rows = jQuery('#combined_table tr.nowrap');
            let data = [];
            let header = [];
            jQuery('#combined_table tr:eq(0) th img').each(function() {
                header.push(jQuery(this).attr('src').split('/').pop().replace('.webp','').replace('unit_',''));
            });

            rows.each(function() {
                let village = {};
                header.forEach((unit, i) => {
                    let val = parseInt(jQuery(this).find(`td:eq(${i+1})`).text().replace('.',''), 10) || 0;
                    village[unit] = val;
                });
                data.push(village);
            });
            return data;
        }

        function getTotalHomeTroops(homeTroops) {
            let t = { spear:0, sword:0, axe:0, archer:0, spy:0, light:0, marcher:0, heavy:0, ram:0, catapult:0, knight:0, snob:0 };
            homeTroops.forEach(v => {
                for (let u in t) { if(v[u]) t[u] += v[u]; }
            });
            return t;
        }

        function getTroopsBBCode(total, nuke) {
            return `[b]Resumo da Conta[/b]\n[b]Nukes Full:[/b] ${nuke.full}\n[b]Nukes Semi:[/b] ${nuke.semi}\n\n[unit]spear[/unit] ${total.spear} | [unit]sword[/unit] ${total.sword} | [unit]heavy[/unit] ${total.heavy}`;
        }

        function getServerTime() {
            return jQuery('#serverDate').text() + ' ' + jQuery('#serverTime').text();
        }
    }
);
