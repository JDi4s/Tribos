(function () {
    const SCRIPT_NS = 'nobres_final_modern_v6';
    const DIALOG_ID = 'nobres_final_modern_dialog';

    try { $(document).off('.' + SCRIPT_NS); } catch (e) {}
    try { Dialog.close(); } catch (e) {}

    class NobresCalculator {
        constructor() {
            this.resources = {
                villages: { wood: 0, stone: 0, iron: 0 },
                ownTransit: { wood: 0, stone: 0, iron: 0 },
                externalIncoming: { wood: 0, stone: 0, iron: 0 }
            };

            this.coinCostBase = { wood: 28000, stone: 30000, iron: 25000 };
            this.snobCost = { wood: 40000, stone: 50000, iron: 50000 };

            this.academy = {
                totalMinted: 0,
                savedCoins: 0,
                missingCoins: 25
            };

            this.icons = {
                wood: 'https://dspt.innogamescdn.com/asset/2a2f957f/graphic/holz.png',
                stone: 'https://dspt.innogamescdn.com/asset/2a2f957f/graphic/lehm.png',
                iron: 'https://dspt.innogamescdn.com/asset/2a2f957f/graphic/eisen.png'
            };
        }

        async init() {
            await this.loadData();
            this.createUI();
            this.bindEvents();
            this.refreshUI();
        }

        buildUrl(screen, mode = null, extraParams = {}) {
            let url = `/game.php?village=${game_data.village.id}&screen=${screen}`;
            if (mode) url += `&mode=${mode}`;

            Object.entries(extraParams).forEach(([k, v]) => {
                url += `&${k}=${encodeURIComponent(v)}`;
            });

            if (game_data.player.sitter !== "0") {
                url += `&t=${game_data.player.id}`;
            }

            return url;
        }

        async fetchPage(url) {
            try {
                return await $.get(url);
            } catch (e) {
                console.error('Erro ao carregar:', url, e);
                return '';
            }
        }

        syncFetch(url) {
            let temp = '';
            $.ajax({
                url,
                async: false,
                success: function (data) { temp = data; },
                error: function () { temp = ''; }
            });
            return temp;
        }

        parseNumber(text) {
            return parseInt(String(text || '').replace(/[^\d]/g, ''), 10) || 0;
        }

        format(n) {
            return new Intl.NumberFormat('pt-PT').format(Number(n || 0));
        }

        addRes(target, src) {
            target.wood += src.wood || 0;
            target.stone += src.stone || 0;
            target.iron += src.iron || 0;
        }

        sumRes(...items) {
            return items.reduce((acc, cur) => ({
                wood: acc.wood + (cur?.wood || 0),
                stone: acc.stone + (cur?.stone || 0),
                iron: acc.iron + (cur?.iron || 0)
            }), { wood: 0, stone: 0, iron: 0 });
        }

        async loadData() {
            await this.getVillageResources();
            await this.getTransitResources();
            await this.getAcademyData();
        }

        async getVillageResources() {
            const html = await this.fetchPage(this.buildUrl('overview_villages', 'prod'));
            const dom = $.parseHTML(html);
            const rows = $(dom).find('#production_table tbody tr');
            const total = { wood: 0, stone: 0, iron: 0 };

            rows.each((_, row) => {
                const $row = $(row);

                let wood = 0;
                let stone = 0;
                let iron = 0;

                const resourceCell = $row.find('td').filter(function () {
                    return $(this).find('.wood, .stone, .iron').length > 0;
                }).first();

                if (resourceCell.length) {
                    wood = this.parseNumber(resourceCell.find('.wood').first().text());
                    stone = this.parseNumber(resourceCell.find('.stone').first().text());
                    iron = this.parseNumber(resourceCell.find('.iron').first().text());
                }

                if (!wood && !stone && !iron) {
                    const likelyCell = $row.find('td').eq(3);
                    const txt = likelyCell.text().replace(/\s+/g, ' ').trim();
                    const nums = txt.match(/\d[\d.\s]*/g) || [];
                    if (nums.length >= 3) {
                        wood = this.parseNumber(nums[0]);
                        stone = this.parseNumber(nums[1]);
                        iron = this.parseNumber(nums[2]);
                    }
                }

                total.wood += wood;
                total.stone += stone;
                total.iron += iron;
            });

            this.resources.villages = total;
        }

        extractResourcesByIcons($cell) {
            const res = { wood: 0, stone: 0, iron: 0 };

            $cell.find('span.icon.header').each((_, el) => {
                const $icon = $(el);
                const amount = this.parseNumber($icon.parent().text());

                if ($icon.hasClass('wood')) res.wood += amount;
                if ($icon.hasClass('stone')) res.stone += amount;
                if ($icon.hasClass('iron')) res.iron += amount;
            });

            if (!res.wood && !res.stone && !res.iron) {
                const txt = $cell.text().replace(/\s+/g, ' ').trim();
                const nums = txt.match(/\d[\d.\s]*/g) || [];
                if (nums.length === 1) {
                    const value = this.parseNumber(nums[0]);
                    const html = $cell.html() || '';

                    if (/header wood|class="wood"|holz/i.test(html)) res.wood = value;
                    if (/header stone|class="stone"|lehm|argila/i.test(html)) res.stone = value;
                    if (/header iron|class="iron"|eisen|ferro/i.test(html)) res.iron = value;
                } else if (nums.length >= 3) {
                    res.wood = this.parseNumber(nums[0]);
                    res.stone = this.parseNumber(nums[1]);
                    res.iron = this.parseNumber(nums[2]);
                }
            }

            return res;
        }

        parseOwnTraderTable(html) {
            const dom = $.parseHTML(html);
            const $table = $(dom).find('#trades_table');
            const total = { wood: 0, stone: 0, iron: 0 };

            $table.find('tbody > tr').each((_, tr) => {
                const $tr = $(tr);
                const $tds = $tr.find('td');
                if ($tds.length < 9) return;

                const arrowImg = $tds.eq(1).find('img').attr('src') || '';
                const isOutgoing = /outgoing\.webp/i.test(arrowImg);
                if (!isOutgoing) return;

                const $resCell = $tds.last();
                if ($resCell.hasClass('hidden')) return;

                const res = this.extractResourcesByIcons($resCell);
                this.addRes(total, res);
            });

            return total;
        }

        parseIncomingTraderTable(html) {
            const dom = $.parseHTML(html);
            const $table = $(dom).find('#trades_table');
            const total = { wood: 0, stone: 0, iron: 0 };

            $table.find('tbody > tr').each((_, tr) => {
                const $tr = $(tr);
                const $tds = $tr.find('td');
                if ($tds.length < 9) return;

                const $resCell = $tds.last();
                if ($resCell.hasClass('hidden')) return;

                const res = this.extractResourcesByIcons($resCell);
                if (res.wood || res.stone || res.iron) {
                    this.addRes(total, res);
                }
            });

            return total;
        }

        async getTransitResources() {
            const ownHtml = await this.fetchPage(this.buildUrl('overview_villages', 'trader', { type: 'own' }));
            const incHtml = await this.fetchPage(this.buildUrl('overview_villages', 'trader', { type: 'inc' }));

            this.resources.ownTransit = this.parseOwnTraderTable(ownHtml);
            this.resources.externalIncoming = this.parseIncomingTraderTable(incHtml);
        }

        async getAcademyData() {
            const html = await this.fetchPage(this.buildUrl('snob'));
            const text = $('<div>').html(html).text().replace(/\s+/g, ' ').trim();

            const totalMatch =
                text.match(/Moedas de ouro\s*Total:\s*(\d+)/i) ||
                text.match(/Total:\s*(\d+)/i);

            const missingMatch =
                text.match(/ainda faltam:\s*(\d+)\s*moedas de ouro/i) ||
                text.match(/faltam:\s*(\d+)\s*moedas de ouro/i);

            const savedMatch =
                text.match(/Já poupado para o limite de nobres\s*\d+:\s*(\d+)\s*moedas de ouro/i) ||
                text.match(/Já poupado.*?:\s*(\d+)\s*moedas de ouro/i);

            this.academy.totalMinted = totalMatch ? parseInt(totalMatch[1], 10) : 0;
            this.academy.missingCoins = missingMatch ? parseInt(missingMatch[1], 10) : 25;
            this.academy.savedCoins = savedMatch ? parseInt(savedMatch[1], 10) : Math.max(0, 25 - this.academy.missingCoins);

            if (this.academy.savedCoins < 0 || this.academy.savedCoins > 24) {
                this.academy.savedCoins = Math.max(0, 25 - this.academy.missingCoins);
            }
        }

        getCurrentGroupName() {
            try {
                const html = $.parseHTML(
                    this.syncFetch(this.buildUrl('overview_villages', 'groups', { type: 'static' }))
                );

                let groupName = 'Todos';
                const groups = $(html).find('.vis_item').find('a,strong');

                if ($(groups).length > 0) {
                    $.each(groups, function (_, group) {
                        if (String(group.getAttribute('data-group-id')) === String(game_data.group_id)) {
                            const val = $(group).text().trim();
                            groupName = val.substring(1, val.length - 1);
                        }
                    });
                }

                return groupName || 'Todos';
            } catch (e) {
                return 'Todos';
            }
        }

        getMintDiscount() {
            const raw = $('#nc_discount').val();
            const val = parseFloat(String(raw || '0').replace(',', '.'));
            return isNaN(val) ? 0 : Math.max(0, Math.min(100, val));
        }

        getSavedCoins() {
            const raw = $('#nc_saved').val();
            const val = this.parseNumber(raw);
            return Math.max(0, Math.min(24, val));
        }

        getMintedCoins() {
            const raw = $('#nc_minted').val();
            const val = this.parseNumber(raw);
            return Math.max(0, val);
        }

        includeIncoming() {
            return $('#nc_include_incoming').is(':checked');
        }

        getDiscountedCoinCost() {
            const discount = this.getMintDiscount() / 100;
            return {
                wood: Math.round(this.coinCostBase.wood * (1 - discount)),
                stone: Math.round(this.coinCostBase.stone * (1 - discount)),
                iron: Math.round(this.coinCostBase.iron * (1 - discount))
            };
        }

        calcCoinsFromResources(res, coinCost) {
            return Math.floor(Math.min(
                (res.wood || 0) / coinCost.wood,
                (res.stone || 0) / coinCost.stone,
                (res.iron || 0) / coinCost.iron
            ));
        }

        calcMaxNoblesFromResources(res, savedCoins, coinCost) {
            let nobles = 0;
            let current = { ...res };
            let saved = savedCoins;

            while (true) {
                const missingCoins = Math.max(0, 25 - saved);

                const cost = {
                    wood: this.snobCost.wood + (coinCost.wood * missingCoins),
                    stone: this.snobCost.stone + (coinCost.stone * missingCoins),
                    iron: this.snobCost.iron + (coinCost.iron * missingCoins)
                };

                if (
                    current.wood >= cost.wood &&
                    current.stone >= cost.stone &&
                    current.iron >= cost.iron
                ) {
                    current.wood -= cost.wood;
                    current.stone -= cost.stone;
                    current.iron -= cost.iron;
                    nobles++;
                    saved = 0;
                } else {
                    break;
                }
            }

            return { nobles, remaining: current };
        }

        calc() {
            const villages = this.resources.villages;
            const ownTransit = this.resources.ownTransit;
            const externalIncoming = this.resources.externalIncoming;

            const totalOwn = this.sumRes(villages, ownTransit);
            const totalWithIncoming = this.sumRes(villages, ownTransit, externalIncoming);
            const usableTotal = this.includeIncoming() ? totalWithIncoming : totalOwn;

            const savedCoins = this.getSavedCoins();
            const mintedCoins = this.getMintedCoins();
            const coinCost = this.getDiscountedCoinCost();
            const missingCoins = Math.max(0, 25 - savedCoins);

            const coinsPossible = this.calcCoinsFromResources(usableTotal, coinCost);
            const max = this.calcMaxNoblesFromResources(usableTotal, savedCoins, coinCost);

            return {
                villages,
                ownTransit,
                externalIncoming,
                totalOwn,
                totalWithIncoming,
                usableTotal,
                savedCoins,
                mintedCoins,
                coinCost,
                missingCoins,
                coinsPossible,
                noblesPossible: max.nobles
            };
        }

        resourceRows(res) {
            return `
                <div class="nc-line">
                    <span class="nc-res-label"><img src="${this.icons.wood}" class="nc-res-icon"> Madeira</span>
                    <b>${this.format(res.wood)}</b>
                </div>
                <div class="nc-line">
                    <span class="nc-res-label"><img src="${this.icons.stone}" class="nc-res-icon"> Barro</span>
                    <b>${this.format(res.stone)}</b>
                </div>
                <div class="nc-line">
                    <span class="nc-res-label"><img src="${this.icons.iron}" class="nc-res-icon"> Ferro</span>
                    <b>${this.format(res.iron)}</b>
                </div>
            `;
        }

        createUI() {
            const currentGroup = this.getCurrentGroupName();
            const playerName = game_data.player.name;
            const worldName = game_data.world;

            const html = `
<div id="nc-root">
    <div class="nc-shell">
        <div class="nc-header">
            <div>
                <div class="nc-kicker">Tribal Wars</div>
                <h3>Calculadora de Nobres</h3>
                <div class="nc-sub">Recursos, moedas e próximos nobres</div>
            </div>
            <div class="nc-stamp">${playerName}</div>
        </div>

        <div class="nc-topbar">
            <div class="nc-meta">
                <div class="nc-pill"><span>Grupo</span><strong>${currentGroup}</strong></div>
                <div class="nc-pill"><span>Jogador</span><strong>${playerName}</strong></div>
                <div class="nc-pill"><span>Mundo</span><strong>${worldName}</strong></div>
            </div>
            <div class="nc-actions">
                <button id="nc-refresh" class="nc-btn nc-btn-secondary">Atualizar</button>
                <button id="nc-copy" class="nc-btn nc-btn-primary">Copiar resumo</button>
            </div>
        </div>

        <div class="nc-grid">
            <div class="nc-panel">
                <div class="nc-panel-head"><h4>Recursos</h4></div>

                <div class="nc-mini-grid">
                    <div class="nc-stat-card">
                        <div class="nc-stat-title">Nas aldeias</div>
                        <div id="nc_villages_detail"></div>
                    </div>

                    <div class="nc-stat-card">
                        <div class="nc-stat-title">Teus em trânsito</div>
                        <div id="nc_own_detail"></div>
                    </div>

                    <div class="nc-stat-card">
                        <div class="nc-stat-title">Externos a chegar</div>
                        <div id="nc_inc_detail"></div>
                    </div>
                </div>

                <div class="nc-check">
                    <label>
                        <input type="checkbox" id="nc_include_incoming" checked>
                        Incluir recursos a chegar no cálculo
                    </label>
                </div>

                <div class="nc-panel-head nc-total-head"><h4>Total considerado no cálculo</h4></div>
                <div class="nc-big-total" id="nc_usable_detail"></div>
            </div>

            <div class="nc-panel">
                <div class="nc-panel-head"><h4>Academia e custos</h4></div>

                <div class="nc-form">
                    <div class="nc-field">
                        <label>Moedas poupadas p/ próximo nobre</label>
                        <input id="nc_saved" type="text" value="${this.academy.savedCoins}">
                    </div>

                    <div class="nc-field">
                        <label>Moedas já cunhadas</label>
                        <input id="nc_minted" type="text" value="${this.academy.totalMinted}">
                    </div>

                    <div class="nc-field">
                        <label>Desconto moeda (%)</label>
                        <input id="nc_discount" type="text" value="0">
                    </div>
                </div>

                <div class="nc-box">
                    <div class="nc-box-title">Custo da moeda</div>
                    <div class="nc-line"><span class="nc-res-label"><img src="${this.icons.wood}" class="nc-res-icon"> Madeira</span><b id="nc_coin_wood">-</b></div>
                    <div class="nc-line"><span class="nc-res-label"><img src="${this.icons.stone}" class="nc-res-icon"> Barro</span><b id="nc_coin_stone">-</b></div>
                    <div class="nc-line"><span class="nc-res-label"><img src="${this.icons.iron}" class="nc-res-icon"> Ferro</span><b id="nc_coin_iron">-</b></div>
                </div>
            </div>
        </div>

        <div class="nc-results">
            <div class="nc-result-card">
                <div class="nc-result-label">Moedas possíveis</div>
                <div class="nc-result-value" id="nc_result_coins">-</div>
            </div>

            <div class="nc-result-card">
                <div class="nc-result-label">Nobres possíveis</div>
                <div class="nc-result-value" id="nc_result_nobles">-</div>
            </div>

            <div class="nc-result-card">
                <div class="nc-result-label">Moedas em falta p/ próximo</div>
                <div class="nc-result-value" id="nc_result_missing">-</div>
            </div>
        </div>

        <div class="nc-footer">Calculadora de Nobres by JDi4s</div>
    </div>
</div>

<style>
#popup_box_${DIALOG_ID} { width: unset !important; }
#popup_box_${DIALOG_ID} .popup_box_content {
    min-width: 960px;
    background: transparent !important;
}
.mds #popup_box_${DIALOG_ID} .popup_box_content { min-width: unset !important; }

#nc-root {
    color: #f3e9d2;
    font-family: Arial, sans-serif;
}

#nc-root .nc-shell {
    background: linear-gradient(180deg, rgba(34,24,17,.96) 0%, rgba(23,16,11,.98) 100%);
    border: 1px solid #6d5231;
    border-radius: 18px;
    box-shadow: 0 18px 45px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04);
    overflow: hidden;
}

#nc-root .nc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 20px 22px;
    background: linear-gradient(135deg, rgba(88,57,29,.95) 0%, rgba(59,37,20,.97) 100%);
    border-bottom: 1px solid #7c5b36;
}

#nc-root .nc-kicker {
    color: #d6b98a;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .12em;
    margin-bottom: 6px;
}

#nc-root h3 {
    margin: 0;
    font-size: 24px;
    color: #fff3da;
}

#nc-root .nc-sub {
    margin-top: 6px;
    color: #d9c4a0;
    font-size: 12px;
}

#nc-root .nc-stamp {
    background: rgba(0,0,0,.18);
    border: 1px solid rgba(255,255,255,.08);
    color: #f6e7c9;
    padding: 10px 12px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 12px;
    white-space: nowrap;
}

#nc-root .nc-topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    padding: 16px 22px;
    background: rgba(0,0,0,.18);
    border-bottom: 1px solid rgba(255,255,255,.05);
}

#nc-root .nc-meta {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

#nc-root .nc-pill {
    background: linear-gradient(180deg, #3a2819 0%, #2b1d12 100%);
    border: 1px solid #6b4f31;
    border-radius: 999px;
    padding: 8px 12px;
    color: #f2e1c0;
    display: flex;
    gap: 8px;
    align-items: center;
}

#nc-root .nc-pill span {
    color: #c9ae80;
    font-size: 11px;
    text-transform: uppercase;
}

#nc-root .nc-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

#nc-root .nc-btn {
    height: 38px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid #7d5b33;
    cursor: pointer;
    font-weight: 700;
    transition: .15s ease;
}

#nc-root .nc-btn:hover {
    transform: translateY(-1px);
    filter: brightness(1.04);
}

#nc-root .nc-btn-secondary {
    background: linear-gradient(180deg, #4d3723 0%, #372517 100%);
    color: #f5e6c8;
}

#nc-root .nc-btn-primary {
    background: linear-gradient(180deg, #b8863b 0%, #8d6228 100%);
    color: #fff8ea;
    border-color: #c89b53;
}

#nc-root .nc-grid {
    display: grid;
    grid-template-columns: 1.15fr .85fr;
    gap: 16px;
    padding: 18px 22px;
}

#nc-root .nc-panel {
    background: linear-gradient(180deg, #2d1f14 0%, #21160e 100%);
    border: 1px solid #644a2d;
    border-radius: 16px;
    padding: 16px;
}

#nc-root .nc-panel-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
}

#nc-root .nc-total-head {
    margin-top: 16px;
}

#nc-root .nc-panel-head h4 {
    margin: 0;
    color: #fff1d5;
    font-size: 16px;
}

#nc-root .nc-mini-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
}

#nc-root .nc-stat-card,
#nc-root .nc-box,
#nc-root .nc-big-total {
    background: linear-gradient(180deg, #3a2819 0%, #2a1d13 100%);
    border: 1px solid #62492c;
    border-radius: 14px;
    padding: 12px;
}

#nc-root .nc-stat-title,
#nc-root .nc-box-title {
    color: #f0d0a4;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 8px;
}

#nc-root .nc-line {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    font-size: 13px;
    padding: 4px 0;
    color: #e7d2b0;
}

#nc-root .nc-line b {
    color: #fff1d7;
    text-align: right;
    word-break: break-word;
}

#nc-root .nc-res-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

#nc-root .nc-res-icon {
    width: 16px;
    height: 16px;
    object-fit: contain;
    vertical-align: middle;
    flex: 0 0 16px;
}

#nc-root .nc-check {
    margin-top: 14px;
    color: #e7d2b0;
}

#nc-root .nc-form {
    display: grid;
    gap: 10px;
    margin-bottom: 12px;
}

#nc-root .nc-field label {
    display: block;
    margin-bottom: 5px;
    font-size: 13px;
    color: #e0bf93;
}

#nc-root .nc-field input {
    width: 100%;
    box-sizing: border-box;
    background: #17100b;
    border: 1px solid #644a2d;
    border-radius: 10px;
    color: #f1e2c6;
    padding: 10px 12px;
    outline: none;
}

#nc-root .nc-results {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 0 22px 18px;
}

#nc-root .nc-result-card {
    background: linear-gradient(180deg, #2d1f14 0%, #21160e 100%);
    border: 1px solid #644a2d;
    border-radius: 16px;
    padding: 18px;
    text-align: center;
}

#nc-root .nc-result-label {
    color: #d8bf97;
    font-size: 13px;
    margin-bottom: 10px;
}

#nc-root .nc-result-value {
    color: #fff4dc;
    font-size: 42px;
    font-weight: 800;
    line-height: 1;
}

#nc-root .nc-footer {
    padding: 0 22px 18px;
    color: #a98d64;
    font-size: 11px;
}

@media (max-width: 980px) {
    #popup_box_${DIALOG_ID} .popup_box_content { min-width: unset; }
    #nc-root .nc-grid,
    #nc-root .nc-results,
    #nc-root .nc-mini-grid {
        grid-template-columns: 1fr;
    }
    #nc-root .nc-header,
    #nc-root .nc-topbar {
        flex-direction: column;
        align-items: stretch;
    }
}
</style>
`;
            Dialog.show(DIALOG_ID, html, Dialog.close());
            $('#popup_box_' + DIALOG_ID).css('width', 'unset');
        }

        refreshUI() {
            const c = this.calc();

            $('#nc_villages_detail').html(this.resourceRows(c.villages));
            $('#nc_own_detail').html(this.resourceRows(c.ownTransit));
            $('#nc_inc_detail').html(this.resourceRows(c.externalIncoming));

            $('#nc_coin_wood').text(this.format(c.coinCost.wood));
            $('#nc_coin_stone').text(this.format(c.coinCost.stone));
            $('#nc_coin_iron').text(this.format(c.coinCost.iron));

            $('#nc_result_coins').text(this.format(c.coinsPossible));
            $('#nc_result_nobles').text(this.format(c.noblesPossible));
            $('#nc_result_missing').text(this.format(c.missingCoins));

            $('#nc_usable_detail').html(this.resourceRows(c.usableTotal));

            const noExternal =
                (c.externalIncoming.wood || 0) === 0 &&
                (c.externalIncoming.stone || 0) === 0 &&
                (c.externalIncoming.iron || 0) === 0;

            if (noExternal) {
                $('#nc_include_incoming').closest('.nc-check').hide();
            } else {
                $('#nc_include_incoming').closest('.nc-check').show();
            }
        }

        buildSummaryText() {
            const c = this.calc();

            return [
                '[b]Calculadora de Nobres[/b]',
                `Moedas já cunhadas: ${this.format(c.mintedCoins)}`,
                `Moedas poupadas p/ próximo: ${this.format(c.savedCoins)}`,
                `Desconto moeda: ${this.getMintDiscount()}%`,
                `Moedas possíveis: ${this.format(c.coinsPossible)}`,
                `Nobres possíveis: ${this.format(c.noblesPossible)}`,
                `Moedas em falta p/ próximo: ${this.format(c.missingCoins)}`,
                `Total considerado: ${this.format(c.usableTotal.wood)} madeira / ${this.format(c.usableTotal.stone)} barro / ${this.format(c.usableTotal.iron)} ferro`
            ].join('\n');
        }

        bindEvents() {
            $(document).off('input.' + SCRIPT_NS, '#nc_saved, #nc_minted, #nc_discount');
            $(document).on('input.' + SCRIPT_NS, '#nc_saved, #nc_minted, #nc_discount', () => this.refreshUI());

            $(document).off('change.' + SCRIPT_NS, '#nc_include_incoming');
            $(document).on('change.' + SCRIPT_NS, '#nc_include_incoming', () => this.refreshUI());

            $(document).off('click.' + SCRIPT_NS, '#nc-refresh');
            $(document).on('click.' + SCRIPT_NS, '#nc-refresh', async () => {
                try { Dialog.close(); } catch (e) {}
                const n = new NobresCalculator();
                await n.init();
            });

            $(document).off('click.' + SCRIPT_NS, '#nc-copy');
            $(document).on('click.' + SCRIPT_NS, '#nc-copy', async () => {
                const txt = this.buildSummaryText();
                try {
                    await navigator.clipboard.writeText(txt);
                    UI.SuccessMessage('Resumo copiado!', 1500);
                } catch (e) {
                    console.log(txt);
                    UI.InfoMessage('Não deu para copiar automaticamente. Vê a consola.', 2000);
                }
            });
        }
    }

    new NobresCalculator().init();
})();
