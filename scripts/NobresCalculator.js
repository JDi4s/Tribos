(() => {
  'use strict';

  if (window.__TW_NOBRES_CALCULATOR_LOADED__) {
    if (window.__TW_NOBRES_CALCULATOR__ && typeof window.__TW_NOBRES_CALCULATOR__.open === 'function') {
      window.__TW_NOBRES_CALCULATOR__.open();
    }
    return;
  }

  window.__TW_NOBRES_CALCULATOR_LOADED__ = true;

  const OVERLAY_ID = 'tw-nc-overlay';
  const STYLE_ID = 'tw-nc-style';

  const app = {
    state: {
      village: { wood: 0, stone: 0, iron: 0 },
      incoming: { wood: 0, stone: 0, iron: 0 },
      includeIncoming: true,
      existingCoins: 0,
      nextNobleCoins: 28000,
      discount: 0,
      coinCost: { wood: 28000, stone: 30000, iron: 25000 },
      snobCost: { wood: 40000, stone: 50000, iron: 50000 }
    },

    n(v) {
      return Math.max(0, Number(v) || 0);
    },

    fmt(v) {
      return new Intl.NumberFormat('pt-PT').format(Math.floor(this.n(v)));
    },

    parseNum(text) {
      if (text == null) return 0;
      const cleaned = String(text).replace(/[^\d]/g, '');
      return cleaned ? parseInt(cleaned, 10) : 0;
    },

    detectVillageResources() {
      const read = (selectors) => {
        for (const s of selectors) {
          const el = document.querySelector(s);
          if (el && el.textContent) {
            const val = this.parseNum(el.textContent);
            if (val > 0 || el.textContent.trim() === '0') return val;
          }
        }
        return 0;
      };

      return {
        wood: read(['#wood', '#l1', '[data-resource="wood"]']),
        stone: read(['#stone', '#l2', '[data-resource="stone"]']),
        iron: read(['#iron', '#l3', '[data-resource="iron"]'])
      };
    },

    effectiveResources() {
      const base = {
        wood: this.n(this.state.village.wood),
        stone: this.n(this.state.village.stone),
        iron: this.n(this.state.village.iron)
      };

      if (!this.state.includeIncoming) return base;

      return {
        wood: base.wood + this.n(this.state.incoming.wood),
        stone: base.stone + this.n(this.state.incoming.stone),
        iron: base.iron + this.n(this.state.incoming.iron)
      };
    },

    discountedCoinCost() {
      const factor = Math.max(0, 1 - this.n(this.state.discount) / 100);
      return {
        wood: Math.floor(this.n(this.state.coinCost.wood) * factor),
        stone: Math.floor(this.n(this.state.coinCost.stone) * factor),
        iron: Math.floor(this.n(this.state.coinCost.iron) * factor)
      };
    },

    canAfford(resources, cost) {
      return (
        resources.wood >= cost.wood &&
        resources.stone >= cost.stone &&
        resources.iron >= cost.iron
      );
    },

    subtract(resources, cost) {
      return {
        wood: Math.max(0, resources.wood - cost.wood),
        stone: Math.max(0, resources.stone - cost.stone),
        iron: Math.max(0, resources.iron - cost.iron)
      };
    },

    calculate() {
      const effective = this.effectiveResources();
      const coin = this.discountedCoinCost();
      const snob = {
        wood: this.n(this.state.snobCost.wood),
        stone: this.n(this.state.snobCost.stone),
        iron: this.n(this.state.snobCost.iron)
      };

      const nextNobleCoins = Math.max(1, this.n(this.state.nextNobleCoins));
      const existingCoins = this.n(this.state.existingCoins);
      const missingCoins = Math.max(0, nextNobleCoins - existingCoins);

      const nextCost = {
        wood: coin.wood * missingCoins + snob.wood,
        stone: coin.stone * missingCoins + snob.stone,
        iron: coin.iron * missingCoins + snob.iron
      };

      const afterThatCost = {
        wood: coin.wood * nextNobleCoins + snob.wood,
        stone: coin.stone * nextNobleCoins + snob.stone,
        iron: coin.iron * nextNobleCoins + snob.iron
      };

      let resourcesLeft = { ...effective };
      let nobles = 0;
      let currentCoins = existingCoins;
      let guard = 0;

      while (guard < 10000) {
        guard += 1;

        const coinsNeeded = Math.max(0, nextNobleCoins - currentCoins);
        const cost = {
          wood: coin.wood * coinsNeeded + snob.wood,
          stone: coin.stone * coinsNeeded + snob.stone,
          iron: coin.iron * coinsNeeded + snob.iron
        };

        if (!this.canAfford(resourcesLeft, cost)) break;

        resourcesLeft = this.subtract(resourcesLeft, cost);
        nobles += 1;
        currentCoins = 0;
      }

      return {
        effective,
        coin,
        missingCoins,
        nobles,
        nextCost,
        afterThatCost,
        resourcesLeft
      };
    },

    injectStyle() {
      if (document.getElementById(STYLE_ID)) return;

      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        #${OVERLAY_ID}{
          position:fixed; inset:0; z-index:999999; font-family:Arial,sans-serif;
        }
        #${OVERLAY_ID} .bg{
          position:absolute; inset:0; background:rgba(0,0,0,.55);
        }
        #${OVERLAY_ID} .panel{
          position:relative; width:min(980px,96vw); max-height:92vh; overflow:auto;
          margin:3vh auto; padding:18px; border-radius:16px;
          background:linear-gradient(180deg,#2c1d12 0%,#1f150e 100%);
          border:1px solid #6d5231; color:#f5ead7;
          box-shadow:0 20px 50px rgba(0,0,0,.45);
        }
        #${OVERLAY_ID} h2,#${OVERLAY_ID} h3{margin:0 0 10px}
        #${OVERLAY_ID} .top,#${OVERLAY_ID} .actions{display:flex;justify-content:space-between;align-items:center;gap:10px}
        #${OVERLAY_ID} .grid{display:grid;gap:14px;margin-top:14px}
        #${OVERLAY_ID} .g2{grid-template-columns:1fr 1fr}
        #${OVERLAY_ID} .g3{grid-template-columns:repeat(3,1fr)}
        #${OVERLAY_ID} .g4{grid-template-columns:repeat(4,1fr)}
        #${OVERLAY_ID} .box{
          background:linear-gradient(180deg,#392719 0%,#281b12 100%);
          border:1px solid #66492c; border-radius:14px; padding:14px;
        }
        #${OVERLAY_ID} .mini{
          background:rgba(0,0,0,.18); border:1px solid rgba(255,255,255,.06);
          border-radius:12px; padding:10px; text-align:center;
        }
        #${OVERLAY_ID} .label{font-size:11px; color:#ceb185}
        #${OVERLAY_ID} .value{margin-top:6px; font-size:18px; font-weight:800; color:#fff7e8}
        #${OVERLAY_ID} .big{font-size:28px; font-weight:800; color:#fff}
        #${OVERLAY_ID} .row{display:grid;grid-template-columns:1fr 160px;gap:10px;align-items:center;margin:8px 0}
        #${OVERLAY_ID} input{
          height:34px; padding:0 10px; border-radius:10px;
          border:1px solid #725332; background:#160f0a; color:#f5ead7;
        }
        #${OVERLAY_ID} .check{display:flex;align-items:center;gap:8px;margin-top:8px}
        #${OVERLAY_ID} button{
          height:36px; padding:0 14px; border-radius:10px; cursor:pointer;
          border:1px solid #7d5b33; font-weight:700;
        }
        #${OVERLAY_ID} .btn2{background:linear-gradient(180deg,#4c3622 0%,#342316 100%); color:#f5ead7}
        #${OVERLAY_ID} .btn1{background:linear-gradient(180deg,#bc8a3d 0%,#8d6228 100%); color:#fff9ed}
        #${OVERLAY_ID} .section{margin:10px 0 8px; font-size:12px; font-weight:700; color:#fff0d3}
        #${OVERLAY_ID} .line{margin:4px 0; font-size:13px}
        @media (max-width:900px){
          #${OVERLAY_ID} .g2,#${OVERLAY_ID} .g3,#${OVERLAY_ID} .g4,#${OVERLAY_ID} .row{grid-template-columns:1fr}
        }
      `;
      document.head.appendChild(style);
    },

    cards(values) {
      return `
        <div class="grid g3">
          <div class="mini"><div class="label">Madeira</div><div class="value">${this.fmt(values.wood)}</div></div>
          <div class="mini"><div class="label">Barro</div><div class="value">${this.fmt(values.stone)}</div></div>
          <div class="mini"><div class="label">Ferro</div><div class="value">${this.fmt(values.iron)}</div></div>
        </div>
      `;
    },

    html() {
      const plan = this.calculate();

      return `
        <div id="${OVERLAY_ID}">
          <div class="bg"></div>
          <div class="panel">
            <div class="top">
              <div>
                <div style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#cfb283">Tribal Wars</div>
                <h2>Calculadora de Nobres</h2>
              </div>
              <button id="tw-nc-close" class="btn2">Fechar</button>
            </div>

            <div class="grid g2">
              <div class="box">
                <h3>Recursos</h3>
                <div class="section">Na aldeia</div>
                ${this.cards(this.state.village)}

                <div class="section">Em chegada</div>
                <div class="grid g3">
                  <div class="row" style="grid-template-columns:1fr">
                    <input id="tw-in-wood" type="number" min="0" value="${this.state.incoming.wood}" placeholder="Madeira em chegada">
                  </div>
                  <div class="row" style="grid-template-columns:1fr">
                    <input id="tw-in-stone" type="number" min="0" value="${this.state.incoming.stone}" placeholder="Barro em chegada">
                  </div>
                  <div class="row" style="grid-template-columns:1fr">
                    <input id="tw-in-iron" type="number" min="0" value="${this.state.incoming.iron}" placeholder="Ferro em chegada">
                  </div>
                </div>

                <label class="check">
                  <input id="tw-include-incoming" type="checkbox" ${this.state.includeIncoming ? 'checked' : ''}>
                  <span>Incluir recursos em chegada no cálculo</span>
                </label>

                <div class="section">Total usado no cálculo</div>
                ${this.cards(plan.effective)}
              </div>

              <div class="box">
                <h3>Configuração</h3>
                <div class="row"><label>Moedas do próximo nobre</label><input id="tw-next-noble" type="number" min="1" value="${this.state.nextNobleCoins}"></div>
                <div class="row"><label>Moedas já existentes</label><input id="tw-existing-coins" type="number" min="0" value="${this.state.existingCoins}"></div>
                <div class="row"><label>Desconto (%)</label><input id="tw-discount" type="number" min="0" max="100" step="0.1" value="${this.state.discount}"></div>

                <div class="section">Custo por moeda</div>
                <div class="row"><label>Madeira</label><input id="tw-coin-wood" type="number" min="0" value="${this.state.coinCost.wood}"></div>
                <div class="row"><label>Barro</label><input id="tw-coin-stone" type="number" min="0" value="${this.state.coinCost.stone}"></div>
                <div class="row"><label>Ferro</label><input id="tw-coin-iron" type="number" min="0" value="${this.state.coinCost.iron}"></div>

                <div class="section">Custo do nobre</div>
                <div class="row"><label>Madeira</label><input id="tw-snob-wood" type="number" min="0" value="${this.state.snobCost.wood}"></div>
                <div class="row"><label>Barro</label><input id="tw-snob-stone" type="number" min="0" value="${this.state.snobCost.stone}"></div>
                <div class="row"><label>Ferro</label><input id="tw-snob-iron" type="number" min="0" value="${this.state.snobCost.iron}"></div>
              </div>
            </div>

            <div class="grid g4">
              <div class="box"><h3>Nobres possíveis</h3><div class="big">${plan.nobles}</div></div>
              <div class="box"><h3>Moedas em falta</h3><div class="big">${this.fmt(plan.missingCoins)}</div></div>
              <div class="box">
                <h3>Custo do próximo</h3>
                <div class="line">Madeira: <strong>${this.fmt(plan.nextCost.wood)}</strong></div>
                <div class="line">Barro: <strong>${this.fmt(plan.nextCost.stone)}</strong></div>
                <div class="line">Ferro: <strong>${this.fmt(plan.nextCost.iron)}</strong></div>
              </div>
              <div class="box">
                <h3>Custo do seguinte</h3>
                <div class="line">Madeira: <strong>${this.fmt(plan.afterThatCost.wood)}</strong></div>
                <div class="line">Barro: <strong>${this.fmt(plan.afterThatCost.stone)}</strong></div>
                <div class="line">Ferro: <strong>${this.fmt(plan.afterThatCost.iron)}</strong></div>
              </div>
            </div>

            <div class="box" style="margin-top:14px">
              <h3>Recursos que sobram</h3>
              ${this.cards(plan.resourcesLeft)}
            </div>

            <div class="actions" style="margin-top:14px">
              <button id="tw-refresh" class="btn2">Ler recursos da aldeia</button>
              <button id="tw-recalc" class="btn1">Recalcular</button>
            </div>
          </div>
        </div>
      `;
    },

    syncInputs() {
      const g = (id) => document.getElementById(id);

      this.state.incoming.wood = this.n(g('tw-in-wood')?.value);
      this.state.incoming.stone = this.n(g('tw-in-stone')?.value);
      this.state.incoming.iron = this.n(g('tw-in-iron')?.value);
      this.state.includeIncoming = !!g('tw-include-incoming')?.checked;

      this.state.nextNobleCoins = this.n(g('tw-next-noble')?.value);
      this.state.existingCoins = this.n(g('tw-existing-coins')?.value);
      this.state.discount = this.n(g('tw-discount')?.value);

      this.state.coinCost.wood = this.n(g('tw-coin-wood')?.value);
      this.state.coinCost.stone = this.n(g('tw-coin-stone')?.value);
      this.state.coinCost.iron = this.n(g('tw-coin-iron')?.value);

      this.state.snobCost.wood = this.n(g('tw-snob-wood')?.value);
      this.state.snobCost.stone = this.n(g('tw-snob-stone')?.value);
      this.state.snobCost.iron = this.n(g('tw-snob-iron')?.value);
    },

    render() {
      const old = document.getElementById(OVERLAY_ID);
      if (old) old.remove();
      document.body.insertAdjacentHTML('beforeend', this.html());
      this.bind();
    },

    bind() {
      document.getElementById('tw-nc-close')?.addEventListener('click', () => this.close());
      document.querySelector(`#${OVERLAY_ID} .bg`)?.addEventListener('click', () => this.close());

      document.getElementById('tw-refresh')?.addEventListener('click', () => {
        this.syncInputs();
        this.state.village = this.detectVillageResources();
        this.render();
      });

      document.getElementById('tw-recalc')?.addEventListener('click', () => {
        this.syncInputs();
        this.render();
      });
    },

    open() {
      this.injectStyle();
      this.state.village = this.detectVillageResources();
      this.render();
    },

    close() {
      document.getElementById(OVERLAY_ID)?.remove();
    }
  };

  window.__TW_NOBRES_CALCULATOR__ = app;
  app.open();
})();
