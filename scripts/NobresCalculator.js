(function () {
    var SCRIPT_NS = 'nobres_final_clean';
    var DIALOG_ID = 'nobres_calculator_dialog';

    try { $(document).off('.' + SCRIPT_NS); } catch (e) {}
    try { Dialog.close(); } catch (e) {}

    class NobresCalculator {

        constructor() {
            this.totalResources = { wood: 0, stone: 0, iron: 0 };
            this.incomingResources = { wood: 0, stone: 0, iron: 0 };
            this.snob = { total: 0, saved: 0, missing: 0 };
        }

        async init() {
            await this.loadData();
            this.createUI();
        }

        #generateUrl(screen, mode = null, extraParams = {}) {
            let url = `/game.php?village=${game_data.village.id}&screen=${screen}`;
            if (mode) url += `&mode=${mode}`;
            Object.entries(extraParams).forEach(([k, v]) => url += `&${k}=${v}`);
            return url;
        }

        #fetch(url) {
            let res = null;
            $.ajax({
                url,
                async: false,
                success: d => res = d
            });
            return res;
        }

        #parseNumber(text) {
            return parseInt(String(text).replace(/[^\d]/g, ''), 10) || 0;
        }

        async loadData() {
            await this.getVillageResources();
            await this.getIncoming();
            await this.getSnob();
        }

        // 🔹 Recursos das aldeias
        async getVillageResources() {
            const html = this.#fetch(this.#generateUrl('overview_villages', 'prod'));
            const dom = $.parseHTML(html);
            const rows = $(dom).find('#production_table tbody tr');

            rows.each((_, r) => {
                const cell = $(r).find('td').eq(3);

                this.totalResources.wood += this.#parseNumber(cell.find('.wood').text());
                this.totalResources.stone += this.#parseNumber(cell.find('.stone').text());
                this.totalResources.iron += this.#parseNumber(cell.find('.iron').text());
            });
        }

        // 🔹 Incoming + envios internos
        async getIncoming() {
            const types = ['inc', 'own'];

            for (const type of types) {
                const html = this.#fetch(this.#generateUrl('overview_villages', 'trader', { type }));
                const dom = $.parseHTML(html);
                const rows = $(dom).find('#trades_table tbody tr');

                rows.each((_, r) => {
                    const cell = $(r).find('td').last();

                    // 🔥 parsing correto para o teu mundo
                    const res = cell.text().trim().split(/\s+/);

                    const wood = this.#parseNumber(res[0]);
                    const stone = this.#parseNumber(res[1]);
                    const iron = this.#parseNumber(res[2]);

                    this.incomingResources.wood += wood;
                    this.incomingResources.stone += stone;
                    this.incomingResources.iron += iron;
                });
            }
        }

        // 🔹 Academia (moedas automáticas)
        async getSnob() {
            const html = this.#fetch(this.#generateUrl('snob'));
            const text = String(html);

            this.snob.total = parseInt((text.match(/Total:\s*(\d+)/) || [])[1]) || 0;
            this.snob.saved = parseInt((text.match(/Já poupado.*?(\d+)/) || [])[1]) || 0;
            this.snob.missing = parseInt((text.match(/faltam:\s*(\d+)/) || [])[1]) || 0;
        }

        calc() {
            const total = {
                wood: this.totalResources.wood + this.incomingResources.wood,
                stone: this.totalResources.stone + this.incomingResources.stone,
                iron: this.totalResources.iron + this.incomingResources.iron
            };

            const coinCost = { wood: 28000, stone: 30000, iron: 25000 };
            const snobCost = { wood: 40000, stone: 50000, iron: 50000 };

            const missingCoins = Math.max(0, 25 - this.snob.saved);

            const cost = {
                wood: snobCost.wood + coinCost.wood * missingCoins,
                stone: snobCost.stone + coinCost.stone * missingCoins,
                iron: snobCost.iron + coinCost.iron * missingCoins
            };

            let can = 0;

            if (
                total.wood >= cost.wood &&
                total.stone >= cost.stone &&
                total.iron >= cost.iron
            ) {
                can = 1;
            }

            return { total, cost, can };
        }

        createUI() {
            const c = this.calc();

            const html = `
<div style="padding:20px;font-family:Arial;color:#2b1d12">

<h2 style="margin-top:0">Calculadora de Nobres</h2>

<hr>

<b>Recursos totais</b><br>
Madeira: ${this.f(c.total.wood)}<br>
Barro: ${this.f(c.total.stone)}<br>
Ferro: ${this.f(c.total.iron)}<br><br>

<b>Recursos a chegar</b><br>
Madeira: ${this.f(this.incomingResources.wood)}<br>
Barro: ${this.f(this.incomingResources.stone)}<br>
Ferro: ${this.f(this.incomingResources.iron)}<br><br>

<b>Moedas</b><br>
Total: ${this.snob.total}<br>
Poupadas: ${this.snob.saved}<br>
Faltam: ${this.snob.missing}<br><br>

<b>Resultado</b><br>
Nobres possíveis: <b>${c.can}</b><br><br>

<b>Custo do próximo nobre</b><br>
Madeira: ${this.f(c.cost.wood)}<br>
Barro: ${this.f(c.cost.stone)}<br>
Ferro: ${this.f(c.cost.iron)}

</div>

<style>
#popup_box_${DIALOG_ID} {
    width: 600px !important;
}

#popup_box_${DIALOG_ID} .popup_box_content {
    background: #f4e4bc !important;
    max-height: 80vh;
    overflow-y: auto;
}
</style>
`;

            Dialog.show(DIALOG_ID, html);
        }

        f(n) {
            return new Intl.NumberFormat('pt-PT').format(n);
        }
    }

    new NobresCalculator().init();
})();
