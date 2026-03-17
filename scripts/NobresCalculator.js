(function () {
    const SCRIPT_NS = 'nobres_brown_final';
    const DIALOG_ID = 'nobres_calculator_brown_dialog';

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

            this.snob = {
                total: 0,
                saved: 0,
                missing: 25
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

        parseNumber(text) {
            return parseInt(String(text).replace(/[^\d]/g, ''), 10) || 0;
        }

        format(n) {
            return new Intl.NumberFormat('pt-PT').format(Math.floor(n || 0));
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

        subRes(a, b) {
            return {
                wood: Math.max(0, (a.wood || 0) - (b.wood || 0)),
                stone: Math.max(0, (a.stone || 0) - (b.stone || 0)),
                iron: Math.max(0, (a.iron || 0) - (b.iron || 0))
            };
        }

        mulRes(a, n) {
            return {
                wood: (a.wood || 0) * n,
                stone: (a.stone || 0) * n,
                iron: (a.iron || 0) * n
            };
        }

        async loadData() {
            await this.getVillageResources();
            await this.getTransitResources();
            await this.getSnobData();
        }

        async getVillageResources() {
            const html = await this.fetchPage(this.buildUrl('overview_villages', 'prod'));
            const dom = $.parseHTML(html);
            const rows = $(dom).find('#production_table tbody tr');

            const total = { wood: 0, stone: 0, iron: 0 };

            rows.each((_, row) => {
                const $row = $(row);
                const cell = $row.find('td').eq(3);

                let wood = this.parseNumber(cell.find('.wood').first().text());
                let stone = this.parseNumber(cell.find('.stone').first().text());
                let iron = this.parseNumber(cell.find('.iron').first().text());

                if (!wood && !stone && !iron) {
                    const text = cell.text().replace(/\s+/g, ' ').trim();
                    const nums = text.match(/\d[\d\.\s]*/g) || [];
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

        extractResourcesFromTraderRow($row) {
            let wood = 0, stone = 0, iron = 0;

            const iconWood = $row.find('.wood').last().text();
            const iconStone = $row.find('.stone').last().text();
            const iconIron = $row.find('.iron').last().text();

            wood = this.parseNumber(iconWood);
            stone = this.parseNumber(iconStone);
            iron = this.parseNumber(iconIron);

            if (!wood && !stone && !iron) {
                const tds = $row.find('td');
                let combined = '';
                tds.each((_, td) => {
                    combined += ' ' + $(td).text();
                });
                combined = combined.replace(/\s+/g, ' ').trim();

                const nums = combined.match(/\d[\d\.\s]*/g) || [];
                if (nums.length >= 3) {
                    const last3 = nums.slice(-3);
                    wood = this.parseNumber(last3[0]);
                    stone = this.parseNumber(last3[1]);
                    iron = this.parseNumber(last3[2]);
                }
            }

            return { wood, stone, iron };
        }

        parseTraderPage(html) {
            const dom = $.parseHTML(html);
            const rows = $(dom).find('#trades_table tbody tr');
            const total = { wood: 0, stone: 0, iron: 0 };

            rows.each((_, row) => {
                const res = this.extractResourcesFromTraderRow($(row));
                this.addRes(total, res);
            });

            return total;
        }

        async getTransitResources() {
            const ownHtml = await this.fetchPage(this.buildUrl('overview_villages', 'trader', { type: 'own' }));
            const incHtml = await this.fetchPage(this.buildUrl('overview_villages', 'trader', { type: 'inc' }));

            this.resources.ownTransit = this.parseTraderPage(ownHtml);
            this.resources.externalIncoming = this.parseTraderPage(incHtml);
        }

        async getSnobData() {
            const html = await this.fetchPage(this.buildUrl('snob'));
            const text = $('<div>').html(html).text().replace(/\s+/g, ' ').trim();

            const totalMatch =
                text.match(/Total\s*:?\s*(\d+)/i) ||
                text.match(/Moedas.*?Total\s*:?\s*(\d+)/i);

            const savedMatch =
                text.match(/Já poupado.*?(\d+)/i) ||
                text.match(/Poupadas?.*?(\d+)/i) ||
                text.match(/Guardadas?.*?(\d+)/i) ||
                text.match(/Coins?.*?saved.*?(\d+)/i);

            const missingMatch =
                text.match(/Faltam\s*:?\s*(\d+)/i) ||
                text.match(/faltam.*?(\d+)/i) ||
                text.match(/Moedas em falta.*?(\d+)/i);

            this.snob.total = totalMatch ? parseInt(totalMatch[1], 10) : 0;
            this.snob.saved = savedMatch ? parseInt(savedMatch[1], 10) : 0;
            this.snob.missing = missingMatch ? parseInt(missingMatch[1], 10) : Math.max(0, 25 - this.snob.saved);

            if (this.snob.saved > 25) {
                this.snob.missing = this.snob.saved % 25 === 0 ? 0 : 25 - (this.snob.saved % 25);
            }
        }

        getMintDiscount() {
            const raw = $('#nobres_discount_input').val();
            const val = parseFloat(String(raw).replace(',', '.'));
            if (isNaN(val)) return 0;
            return Math.max(0, Math.min(100, val));
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
            if (!coinCost.wood || !coinCost.stone || !coinCost.iron) return 0;
            return Math.floor(Math.min(
                (res.wood || 0) / coinCost.wood,
                (res.stone || 0) / coinCost.stone,
                (res.iron || 0) / coinCost.iron
            ));
        }

        calcMaxNoblesFromResources(res, savedCoins, coinCost) {
            let nobles = 0;
            let current = { wood: res.wood, stone: res.stone, iron: res.iron };
            let coinsSaved = savedCoins;

            while (true) {
                const missingCoins = Math.max(0, 25 - coinsSaved);

                const need = {
                    wood: this.snobCost.wood + (coinCost.wood * missingCoins),
                    stone: this.snobCost.stone + (coinCost.stone * missingCoins),
                    iron: this.snobCost.iron + (coinCost.iron * missingCoins)
                };

                if (
                    current.wood >= need.wood &&
                    current.stone >= need.stone &&
                    current.iron >= need.iron
                ) {
                    current = this.subRes(current, need);
                    nobles++;
                    coinsSaved = 0;
                } else {
                    break;
                }
            }

            return {
                nobles,
                remaining: current
            };
        }

        calc() {
            const villages = this.resources.villages;
            const ownTransit = this.resources.ownTransit;
            const externalIncoming = this.resources.externalIncoming;

            const totalOwn = this.sumRes(villages, ownTransit);
            const totalAll = this.sumRes(villages, ownTransit, externalIncoming);

            const coinCost = this.getDiscountedCoinCost();

            const coinsPossibleOwn = this.calcCoinsFromResources(totalOwn, coinCost);
            const coinsPossibleAll = this.calcCoinsFromResources(totalAll, coinCost);

            const maxOwn = this.calcMaxNoblesFromResources(totalOwn, this.snob.saved, coinCost);
            const maxAll = this.calcMaxNoblesFromResources(totalAll, this.snob.saved, coinCost);

            const missingCoinsNext = Math.max(0, 25 - this.snob.saved);

            const nextNobleCost = {
                wood: this.snobCost.wood + (coinCost.wood * missingCoinsNext),
                stone: this.snobCost.stone + (coinCost.stone * missingCoinsNext),
                iron: this.snobCost.iron + (coinCost.iron * missingCoinsNext)
            };

            const canMakeNextNow =
                totalAll.wood >= nextNobleCost.wood &&
                totalAll.stone >= nextNobleCost.stone &&
                totalAll.iron >= nextNobleCost.iron;

            return {
                villages,
                ownTransit,
                externalIncoming,
                totalOwn,
                totalAll,
                coinCost,
                coinsPossibleOwn,
                coinsPossibleAll,
                maxOwn,
                maxAll,
                nextNobleCost,
                canMakeNextNow,
                savedCoins: this.snob.saved,
                totalCoinsScreen: this.snob.total,
                missingCoinsScreen: this.snob.missing
            };
        }

        createUI() {
            const html = `
<div id="nobres_calc_root" class="ncalc-root">
    <div class="ncalc-header">
        <div class="ncalc-title">Calculadora de Nobres</div>
        <div class="ncalc-subtitle">Recursos nas aldeias, em trânsito, cunhagem com desconto e nobres possíveis</div>
    </div>

    <div class="ncalc-grid top">
        <div class="ncalc-card">
            <div class="ncalc-card-title">Opções</div>
            <div class="ncalc-field">
                <label class="ncalc-label">Desconto da cunhagem (%)</label>
                <input id="nobres_discount_input" class="ncalc-input" type="number" min="0" max="100" step="0.1" value="0">
            </div>
            <div class="ncalc-hint">
                Exemplo: 35 = moedas 35% mais baratas.<br>
                O desconto só afeta a cunhagem das moedas.
            </div>
        </div>

        <div class="ncalc-card">
            <div class="ncalc-card-title">Moedas da academia</div>
            <div class="ncalc-stat-row"><span>Total lido</span><b id="ncalc_snob_total">-</b></div>
            <div class="ncalc-stat-row"><span>Poupadas</span><b id="ncalc_snob_saved">-</b></div>
            <div class="ncalc-stat-row"><span>Faltam p/ próximo</span><b id="ncalc_snob_missing">-</b></div>
        </div>

        <div class="ncalc-card">
            <div class="ncalc-card-title">Custo da moeda com desconto</div>
            <div class="ncalc-stat-row"><span>Madeira</span><b id="ncalc_coin_wood">-</b></div>
            <div class="ncalc-stat-row"><span>Barro</span><b id="ncalc_coin_stone">-</b></div>
            <div class="ncalc-stat-row"><span>Ferro</span><b id="ncalc_coin_iron">-</b></div>
        </div>
    </div>

    <div class="ncalc-grid mid">
        <div class="ncalc-card">
            <div class="ncalc-card-title">Recursos base</div>
            <div class="ncalc-stat-row"><span>Nas aldeias</span><b id="ncalc_villages_sum">-</b></div>
            <div class="ncalc-stat-row"><span>Teus em trânsito</span><b id="ncalc_own_sum">-</b></div>
            <div class="ncalc-stat-row"><span>Externos a chegar</span><b id="ncalc_inc_sum">-</b></div>
        </div>

        <div class="ncalc-card">
            <div class="ncalc-card-title">Totais usados</div>
            <div class="ncalc-stat-row"><span>Total teu real</span><b id="ncalc_total_own_sum">-</b></div>
            <div class="ncalc-stat-row"><span>Total geral</span><b id="ncalc_total_all_sum">-</b></div>
            <div class="ncalc-hint">
                Total teu real = aldeias + trânsito teu<br>
                Total geral = total teu real + recursos externos a chegar
            </div>
        </div>

        <div class="ncalc-card">
            <div class="ncalc-card-title">Custo do próximo nobre</div>
            <div class="ncalc-stat-row"><span>Madeira</span><b id="ncalc_next_wood">-</b></div>
            <div class="ncalc-stat-row"><span>Barro</span><b id="ncalc_next_stone">-</b></div>
            <div class="ncalc-stat-row"><span>Ferro</span><b id="ncalc_next_iron">-</b></div>
        </div>
    </div>

    <div class="ncalc-grid result">
        <div class="ncalc-card big">
            <div class="ncalc-card-title">Resultado com total teu real</div>
            <div class="ncalc-big-row">
                <div class="ncalc-big-box">
                    <div class="ncalc-big-label">Moedas possíveis</div>
                    <div class="ncalc-big-value" id="ncalc_coins_own">-</div>
                </div>
                <div class="ncalc-big-box">
                    <div class="ncalc-big-label">Nobres possíveis</div>
                    <div class="ncalc-big-value" id="ncalc_nobles_own">-</div>
                </div>
            </div>
        </div>

        <div class="ncalc-card big">
            <div class="ncalc-card-title">Resultado com total geral</div>
            <div class="ncalc-big-row">
                <div class="ncalc-big-box">
                    <div class="ncalc-big-label">Moedas possíveis</div>
                    <div class="ncalc-big-value" id="ncalc_coins_all">-</div>
                </div>
                <div class="ncalc-big-box">
                    <div class="ncalc-big-label">Nobres possíveis</div>
                    <div class="ncalc-big-value" id="ncalc_nobles_all">-</div>
                </div>
            </div>
        </div>
    </div>

    <div class="ncalc-grid bottom">
        <div class="ncalc-card">
            <div class="ncalc-card-title">Recursos sobrantes após máximo de nobres (total teu real)</div>
            <div class="ncalc-stat-row"><span>Madeira</span><b id="ncalc_left_own_wood">-</b></div>
            <div class="ncalc-stat-row"><span>Barro</span><b id="ncalc_left_own_stone">-</b></div>
            <div class="ncalc-stat-row"><span>Ferro</span><b id="ncalc_left_own_iron">-</b></div>
        </div>

        <div class="ncalc-card">
            <div class="ncalc-card-title">Recursos sobrantes após máximo de nobres (total geral)</div>
            <div class="ncalc-stat-row"><span>Madeira</span><b id="ncalc_left_all_wood">-</b></div>
            <div class="ncalc-stat-row"><span>Barro</span><b id="ncalc_left_all_stone">-</b></div>
            <div class="ncalc-stat-row"><span>Ferro</span><b id="ncalc_left_all_iron">-</b></div>
        </div>

        <div class="ncalc-card">
            <div class="ncalc-card-title">Detalhe dos recursos</div>
            <div class="ncalc-resource-grid">
                <div class="ncalc-res-box">
                    <div class="ncalc-res-title">Aldeias</div>
                    <div id="ncalc_villages_detail">-</div>
                </div>
                <div class="ncalc-res-box">
                    <div class="ncalc-res-title">Teus em trânsito</div>
                    <div id="ncalc_own_detail">-</div>
                </div>
                <div class="ncalc-res-box">
                    <div class="ncalc-res-title">Externos a chegar</div>
                    <div id="ncalc_inc_detail">-</div>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
#popup_box_${DIALOG_ID} {
    width: 980px !important;
    max-width: 98vw !important;
}

#popup_box_${DIALOG_ID} .popup_box_content {
    background:
        linear-gradient(180deg, #2a140a 0%, #1c0d06 100%) !important;
    color: #f5e6c8 !important;
    border: 1px solid #8a5a24 !important;
    border-radius: 14px !important;
    box-shadow: inset 0 0 0 1px rgba(255, 196, 120, 0.08), 0 10px 30px rgba(0,0,0,0.45) !important;
    padding: 14px !important;
    max-height: 88vh !important;
    overflow-y: auto !important;
}

#popup_box_${DIALOG_ID} .popup_box_content a,
#popup_box_${DIALOG_ID} .popup_box_content b,
#popup_box_${DIALOG_ID} .popup_box_content strong {
    color: #fff1d6 !important;
}

#nobres_calc_root.ncalc-root {
    color: #f5e6c8;
    font-family: Arial, Helvetica, sans-serif;
}

.ncalc-header {
    margin-bottom: 14px;
    padding: 12px 14px;
    border: 1px solid #8c5b25;
    border-radius: 16px;
    background: linear-gradient(180deg, rgba(95,47,18,0.35), rgba(47,20,8,0.45));
}

.ncalc-title {
    font-size: 28px;
    font-weight: 700;
    color: #fff2d7;
    margin-bottom: 4px;
}

.ncalc-subtitle {
    font-size: 13px;
    color: #d8b88a;
}

.ncalc-grid {
    display: grid;
    gap: 14px;
    margin-bottom: 14px;
}

.ncalc-grid.top,
.ncalc-grid.mid,
.ncalc-grid.bottom {
    grid-template-columns: repeat(3, 1fr);
}

.ncalc-grid.result {
    grid-template-columns: repeat(2, 1fr);
}

.ncalc-card {
    background: linear-gradient(180deg, rgba(74,35,13,0.52), rgba(33,15,7,0.72));
    border: 1px solid #8c5b25;
    border-radius: 18px;
    padding: 16px;
    box-shadow: inset 0 0 0 1px rgba(255, 200, 120, 0.04);
}

.ncalc-card.big {
    min-height: 150px;
}

.ncalc-card-title {
    color: #fff0d0;
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 14px;
}

.ncalc-field {
    margin-bottom: 10px;
}

.ncalc-label {
    display: block;
    font-size: 13px;
    color: #e0bf93;
    margin-bottom: 6px;
}

.ncalc-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(20, 10, 5, 0.8);
    border: 1px solid #9a6328;
    border-radius: 10px;
    color: #fff2d6;
    padding: 10px 12px;
    font-size: 15px;
    outline: none;
}

.ncalc-input:focus {
    border-color: #c98a3a;
    box-shadow: 0 0 0 2px rgba(201, 138, 58, 0.18);
}

.ncalc-hint {
    font-size: 12px;
    line-height: 1.4;
    color: #cba97b;
}

.ncalc-stat-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 7px 0;
    border-bottom: 1px solid rgba(184, 123, 50, 0.18);
    font-size: 14px;
}

.ncalc-stat-row:last-child {
    border-bottom: 0;
}

.ncalc-stat-row span {
    color: #dfbe93;
}

.ncalc-stat-row b {
    color: #fff3db;
    font-weight: 700;
}

.ncalc-big-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
}

.ncalc-big-box {
    border: 1px solid #8f5f28;
    border-radius: 16px;
    padding: 16px;
    text-align: center;
    background: linear-gradient(180deg, rgba(92, 45, 18, 0.22), rgba(32, 14, 7, 0.34));
}

.ncalc-big-label {
    color: #e0bc8d;
    font-size: 14px;
    margin-bottom: 10px;
}

.ncalc-big-value {
    color: #fff4dc;
    font-size: 42px;
    font-weight: 800;
    line-height: 1;
}

.ncalc-resource-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
}

.ncalc-res-box {
    border: 1px solid rgba(150, 96, 37, 0.65);
    border-radius: 14px;
    padding: 12px;
    background: rgba(42, 19, 9, 0.5);
}

.ncalc-res-title {
    font-size: 13px;
    font-weight: 700;
    color: #f0d0a4;
    margin-bottom: 8px;
}

.ncalc-res-line {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    padding: 2px 0;
}

.ncalc-ok {
    color: #8ee08e !important;
}

.ncalc-warn {
    color: #ffcb85 !important;
}

@media (max-width: 900px) {
    .ncalc-grid.top,
    .ncalc-grid.mid,
    .ncalc-grid.bottom,
    .ncalc-grid.result {
        grid-template-columns: 1fr;
    }
}
</style>
`;

            Dialog.show(DIALOG_ID, html);
        }

        resLines(res) {
            return `
                <div class="ncalc-res-line"><span>Madeira</span><b>${this.format(res.wood)}</b></div>
                <div class="ncalc-res-line"><span>Barro</span><b>${this.format(res.stone)}</b></div>
                <div class="ncalc-res-line"><span>Ferro</span><b>${this.format(res.iron)}</b></div>
            `;
        }

        sumText(res) {
            return `${this.format(res.wood)} / ${this.format(res.stone)} / ${this.format(res.iron)}`;
        }

        refreshUI() {
            const c = this.calc();

            $('#ncalc_snob_total').text(this.format(c.totalCoinsScreen));
            $('#ncalc_snob_saved').text(this.format(c.savedCoins));
            $('#ncalc_snob_missing').text(this.format(Math.max(0, 25 - (c.savedCoins % 25 || 0)) % 25));

            $('#ncalc_coin_wood').text(this.format(c.coinCost.wood));
            $('#ncalc_coin_stone').text(this.format(c.coinCost.stone));
            $('#ncalc_coin_iron').text(this.format(c.coinCost.iron));

            $('#ncalc_villages_sum').text(this.sumText(c.villages));
            $('#ncalc_own_sum').text(this.sumText(c.ownTransit));
            $('#ncalc_inc_sum').text(this.sumText(c.externalIncoming));

            $('#ncalc_total_own_sum').text(this.sumText(c.totalOwn));
            $('#ncalc_total_all_sum').text(this.sumText(c.totalAll));

            $('#ncalc_next_wood').text(this.format(c.nextNobleCost.wood));
            $('#ncalc_next_stone').text(this.format(c.nextNobleCost.stone));
            $('#ncalc_next_iron').text(this.format(c.nextNobleCost.iron));

            $('#ncalc_coins_own').text(this.format(c.coinsPossibleOwn));
            $('#ncalc_nobles_own').text(this.format(c.maxOwn.nobles));

            $('#ncalc_coins_all').text(this.format(c.coinsPossibleAll));
            $('#ncalc_nobles_all').text(this.format(c.maxAll.nobles));

            $('#ncalc_left_own_wood').text(this.format(c.maxOwn.remaining.wood));
            $('#ncalc_left_own_stone').text(this.format(c.maxOwn.remaining.stone));
            $('#ncalc_left_own_iron').text(this.format(c.maxOwn.remaining.iron));

            $('#ncalc_left_all_wood').text(this.format(c.maxAll.remaining.wood));
            $('#ncalc_left_all_stone').text(this.format(c.maxAll.remaining.stone));
            $('#ncalc_left_all_iron').text(this.format(c.maxAll.remaining.iron));

            $('#ncalc_villages_detail').html(this.resLines(c.villages));
            $('#ncalc_own_detail').html(this.resLines(c.ownTransit));
            $('#ncalc_inc_detail').html(this.resLines(c.externalIncoming));
        }

        bindEvents() {
            $(document)
                .off('input.' + SCRIPT_NS, '#nobres_discount_input')
                .on('input.' + SCRIPT_NS, '#nobres_discount_input', () => this.refreshUI());
        }
    }

    new NobresCalculator().init();
})();
