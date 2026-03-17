(() => {
  'use strict';

  const OVERLAY_ID = 'tw-nc-overlay';
  const STYLE_ID = 'tw-nc-style';

  if (window.__TW_NOBRES_CALCULATOR__) {
    window.__TW_NOBRES_CALCULATOR__.open();
    return;
  }

  const app = {
    state: {
      resourcesNow: { wood: 0, stone: 0, iron: 0 },
      incomingResources: { wood: 0, stone: 0, iron: 0 },
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

    floor(v) {
      return Math.floor(this.n(v));
    },

    format(v) {
      return new Intl.NumberFormat('pt-PT').format(this.floor(v));
    },

    parseNumber(text) {
      if (text == null) return 0;
      const cleaned = String(text).replace(/[^\d]/g, '');
      return cleaned ? parseInt(cleaned, 10) : 0;
    },

    qs(sel) {
      return document.querySelector(sel);
    },

    qsa(sel) {
      return Array.from(document.querySelectorAll(sel));
    },

    getText(selectors) {
      for (const selector of selectors) {
        const el = this.qs(selector);
        if (el && el.textContent && el.textContent.trim()) {
          return el.textContent.trim();
        }
      }
      return '';
    },

    detectResourcesNow() {
      const wood = this.parseNumber(this.getText(['#wood', '#l1', '[data-resource="wood"]', '.wood']));
      const stone = this.parseNumber(this.getText(['#stone', '#l2', '[data-resource="stone"]', '.stone']));
      const iron = this.parseNumber(this.getText(['#iron', '#l3', '[data-resource="iron"]', '.iron']));

      return { wood, stone, iron };
    },

    detectIncomingResources() {
      const result = { wood: 0, stone: 0, iron: 0 };

      const rows = this.qsa('table tr, .vis tr, .incoming tr, .commands tr');
      for (const row of rows) {
        const txt = (row.innerText || '').toLowerCase();

        const looksIncoming =
          txt.includes('chegada') ||
          txt.includes('incoming') ||
          txt.includes('a caminho') ||
          txt.includes('transporte') ||
          txt.includes('mercador') ||
          txt.includes('resources') ||
          txt.includes('recursos');

        if (!looksIncoming) continue;

        const imgs = row.querySelectorAll('img');
        for (const img of imgs) {
          const src = img.getAttribute('src') || '';
          const parentText = img.parentElement ? img.parentElement.textContent : '';
          const nearText = parentText || row.innerText || '';
          const val = this.parseNumber(nearText);

          if (src.includes('holz')) result.wood = Math.max(result.wood, val);
          if (src.includes('lehm')) result.stone = Math.max(result.stone, val);
          if (src.includes('eisen')) result.iron = Math.max(result.iron, val);
        }
      }

      return result;
    },

    getEffectiveResources() {
      const base = {
        wood: this.n(this.state.resourcesNow.wood),
        stone: this.n(this.state.resourcesNow.stone),
        iron: this.n(this.state.resourcesNow.iron)
      };

      if (!this.state.includeIncoming) return base;

      return {
        wood: base.wood + this.n(this.state.incomingResources.wood),
        stone: base.stone + this.n(this.state.incomingResources.stone),
        iron: base.iron + this.n(this.state.incomingResources.iron)
      };
    },

    getDiscountedCoinCost() {
      const factor = Math.max(0, 1 - this.n(this.state.discount) / 100);
      return {
        wood: this.floor(this.state.coinCost.wood * factor),
        stone: this.floor(this.state.coinCost.stone * factor),
        iron: this.floor(this.state.coinCost.iron * factor)
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

    calculatePlan() {
      const effectiveResources = this.getEffectiveResources();
      const discountedCoinCost = this.getDiscountedCoinCost();
      const nextNobleCoins = Math.max(1, this.n(this.state.nextNobleCoins));
      const existingCoins = this.n(this.state.existingCoins);

      const missingCoinsForNextNoble = Math.max(0, nextNobleCoins - existingCoins);

      const nextCost = {
        wood: discountedCoinCost.wood * missingCoinsForNextNoble + this.n(this.state.snobCost.wood),
        stone: discountedCoinCost.stone * missingCoinsForNextNoble + this.n(this.state.snobCost.stone),
        iron: discountedCoinCost.iron * missingCoinsForNextNoble + this.n(this.state.snobCost.iron)
      };

      const afterThatCost = {
        wood: discountedCoinCost.wood * nextNobleCoins + this.n(this.state.snobCost.wood),
        stone: discountedCoinCost.stone * nextNobleCoins + this.n(this.state.snobCost.stone),
        iron: discountedCoinCost.iron * nextNobleCoins + this.n(this.state.snobCost.iron)
      };

      let resourcesLeft = { ...effectiveResources };
      let noblesMade = 0;
      let currentCoins = existingCoins;

      while (true) {
        const coinsNeeded = Math.max(0, nextNobleCoins - currentCoins);

        const costThisNoble = {
          wood: discountedCoinCost.wood * coinsNeeded + this.n(this.state.snobCost.wood),
          stone: discountedCoinCost.stone * coinsNeeded + this.n(this.state.snobCost.stone),
          iron: discountedCoinCost.iron * coinsNeeded + this.n(this.state.snobCost.iron)
        };

        if (!this.canAfford(resourcesLeft, costThisNoble)) {
          break;
        }

        resourcesLeft = this.subtract(resourcesLeft, costThisNoble);
        noblesMade += 1;
        currentCoins = 0;
      }

      return {
        effectiveResources,
        discountedCoinCost,
        missingCoinsForNextNoble,
        affordableNobles: noblesMade,
        nextCost,
        afterThatCost,
        resourcesLeft
      };
    },

    syncFromInputs() {
      const g = (id) => document.getElementById(id);

      this.state.nextNobleCoins = this.n(g('tw-nc-next-noble')?.value);
      this.state.existingCoins = this.n(g('tw-nc-existing-coins')?.value);
      this.state.discount = this.n(g('tw-nc-discount')?.value);
      this.state.includeIncoming = !!g('tw-nc-include-incoming')?.checked;

      this.state.coinCost.wood = this.n(g('tw-nc-coin-wood')?.value);
      this.state.coinCost.stone = this.n(g('tw-nc-coin-stone')?.value);
      this.state.coinCost.iron = this.n(g('tw-nc-coin-iron')?.value);

      this.state.snobCost.wood = this.n(g('tw-nc-snob-wood')?.value);
      this.state.snobCost.stone = this.n(g('tw-nc-snob-stone')?.value);
      this.state.snobCost.iron = this.n(g('tw-nc-snob-iron')?.value);
    },

    refreshDetectedData() {
      this.state.resourcesNow = this.detectResourcesNow();
      this.state.incomingResources = this.detectIncomingResources();
    },

    renderResourceCards(values) {
      return `
        <div class="tw-nc-res-grid">
          <div class="tw-nc-card"><div class="tw-nc-label">Madeira</div><div class="tw-nc-value">${this.format(values.wood)}</div></div>
          <div class="tw-nc-card"><div class="tw-nc-label">Barro</div><div class="tw-nc-value">${this.format(values.stone)}</div></div>
          <div class="tw-nc-card"><div class="tw-nc-label">Ferro</div><div class="tw-nc-value">${this.format(values.iron)}</div></div>
        </div>
      `;
    },

    render() {
      this.syncFromInputs?.();
      const plan = this.calculatePlan();

      const html = `
        <div id="${OVERLAY_ID}">
          <div class="tw-nc-backdrop"></div>
          <div class="tw-nc-panel">
            <div class="tw-nc-header">
              <div>
                <div class="tw-nc-kicker">Tribal Wars</div>
                <h2>Calculadora de Nobres</h2>
                <div class="tw-nc-sub">Calcula quantos nobres consegues fazer com os recursos da aldeia</div>
              </div>
              <button id="tw-nc-close" class="tw-nc-btn tw-nc-btn-secondary">Fechar</button>
            </div>

            <div class="tw-nc-grid tw-nc-grid-2">
              <div class="tw-nc-box">
                <h3>Recursos</h3>
                <div class="tw-nc-section-title">Na aldeia agora</div>
                ${this.renderResourceCards(this.state.resourcesNow)}

                <div class="tw-nc-section-title">Em chegada</div>
                ${this.renderResourceCards(this.state.incomingResources)}

                <label class="tw-nc-check">
                  <input id="tw-nc-include-incoming" type="checkbox" ${this.state.includeIncoming ? 'checked' : ''}>
                  <span>Incluir recursos em chegada no cálculo</span>
                </label>

                <div class="tw-nc-section-title">Total usado no cálculo</div>
                ${this.renderResourceCards(plan.effectiveResources)}
              </div>

              <div class="tw-nc-box">
                <h3>Configuração</h3>

                <div class="tw-nc-form-row">
                  <label>Moedas necessárias para o próximo nobre</label>
                  <input id="tw-nc-next-noble" type="number" min="1" value="${this.state.nextNobleCoins}">
                </div>

                <div class="tw-nc-form-row">
                  <label>Moedas já existentes</label>
                  <input id="tw-nc-existing-coins" type="number" min="0" value="${this.state.existingCoins}">
                </div>

                <div class="tw-nc-form-row">
                  <label>Desconto (%)</label>
                  <input id="tw-nc-discount" type="number" min="0" max="100" step="0.1" value="${this.state.discount}">
                </div>

                <div class="tw-nc-inline-grid">
                  <div class="tw-nc-mini-box">
                    <div class="tw-nc-section-title">Custo por moeda</div>
                    <div class="tw-nc-form-row"><label>Madeira</label><input id="tw-nc-coin-wood" type="number" min="0" value="${this.state.coinCost.wood}"></div>
                    <div class="tw-nc-form-row"><label>Barro</label><input id="tw-nc-coin-stone" type="number" min="0" value="${this.state.coinCost.stone}"></div>
                    <div class="tw-nc-form-row"><label>Ferro</label><input id="tw-nc-coin-iron" type="number" min="0" value="${this.state.coinCost.iron}"></div>
                  </div>

                  <div class="tw-nc-mini-box">
                    <div class="tw-nc-section-title">Custo do nobre</div>
                    <div class="tw-nc-form-row"><label>Madeira</label><input id="tw-nc-snob-wood" type="number" min="0" value="${this.state.snobCost.wood}"></div>
                    <div class="tw-nc-form-row"><label>Barro</label><input id="tw-nc-snob-stone" type="number" min="0" value="${this.state.snobCost.stone}"></div>
                    <div class="tw-nc-form-row"><label>Ferro</label><input id="tw-nc-snob-iron" type="number" min="0" value="${this.state.snobCost.iron}"></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="tw-nc-grid tw-nc-grid-4">
              <div class="tw-nc-box">
                <h3>Nobres possíveis</h3>
                <div class="tw-nc-big">${plan.affordableNobles}</div>
              </div>

              <div class="tw-nc-box">
                <h3>Moedas em falta</h3>
                <div class="tw-nc-big">${this.format(plan.missingCoinsForNextNoble)}</div>
              </div>

              <div class="tw-nc-box">
                <h3>Custo do próximo</h3>
                <div class="tw-nc-line">Madeira: <strong>${this.format(plan.nextCost.wood)}</strong></div>
                <div class="tw-nc-line">Barro: <strong>${this.format(plan.nextCost.stone)}</strong></div>
                <div class="tw-nc-line">Ferro: <strong>${this.format(plan.nextCost.iron)}</strong></div>
              </div>

              <div class="tw-nc-box">
                <h3>Custo do seguinte</h3>
                <div class="tw-nc-line">Madeira: <strong>${this.format(plan.afterThatCost.wood)}</strong></div>
                <div class="tw-nc-line">Barro: <strong>${this.format(plan.afterThatCost.stone)}</strong></div>
                <div class="tw-nc-line">Ferro: <strong>${this.format(plan.afterThatCost.iron)}</strong></div>
              </div>
            </div>

            <div class="tw-nc-box">
              <h3>Recursos que sobram</h3>
              ${this.renderResourceCards(plan.resourcesLeft)}
            </div>

            <div class="tw-nc-actions">
              <button id="tw-nc-reload" class="tw-nc-btn tw-nc-btn-secondary">Atualizar leitura</button>
              <button id="tw-nc-recalc" class="tw-nc-btn tw-nc-btn-primary">Recalcular</button>
            </div>
          </div>
        </div>
      `;

      const existing = document.getElementById(OVERLAY_ID);
      if (existing) existing.remove();

      document.body.insertAdjacentHTML('beforeend', html);
      this.bind();
    },

    bind() {
      const recalc = () => {
        this.syncFromInputs();
        this.render();
      };

      document.getElementById('tw-nc-close')?.addEventListener('click', () => this.close());
      document.querySelector(`#${OVERLAY_ID} .tw-nc-backdrop`)?.addEventListener('click', () => this.close());

      document.getElementById('tw-nc-recalc')?.addEventListener('click', recalc);

      document.getElementById('tw-nc-reload')?.addEventListener('click', () => {
        this.syncFromInputs();
        this.refreshDetectedData();
        this.render();
      });

      [
        'tw-nc-next-noble',
        'tw-nc-existing-coins',
        'tw-nc-discount',
        'tw-nc-coin-wood',
        'tw-nc-coin-stone',
        'tw-nc-coin-iron',
        'tw-nc-snob-wood',
        'tw-nc-snob-stone',
        'tw-nc-snob-iron',
        'tw-nc-include-incoming'
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;

        el.addEventListener('change', recalc);
        el.addEventListener('blur', recalc);
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            recalc();
          }
        });
      });
    },

    injectStyle() {
      if (document.getElementById(STYLE_ID)) return;

      const css = `
        #${OVERLAY_ID} {
          position: fixed;
          inset: 0;
          z-index: 999999;
          font-family: Arial, sans-serif;
          color: #f5ead7;
        }
        #${OVERLAY_ID} .tw-nc-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,.55);
        }
        #${OVERLAY_ID} .tw-nc-panel {
          position: relative;
          width: min(1100px, 96vw);
          max-height: 92vh;
          overflow: auto;
          margin: 3vh auto;
          background: linear-gradient(180deg, #2c1d12 0%, #1f150e 100%);
          border: 1px solid #6c4e2c;
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 20px 50px rgba(0,0,0,.45);
        }
        #${OVERLAY_ID} .tw-nc-header,
        #${OVERLAY_ID} .tw-nc-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        #${OVERLAY_ID} .tw-nc-kicker {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: .14em;
          color: #cfb283;
        }
        #${OVERLAY_ID} h2, #${OVERLAY_ID} h3 {
          margin: 0 0 8px;
        }
        #${OVERLAY_ID} .tw-nc-sub {
          color: #d6c1a0;
          font-size: 12px;
        }
        #${OVERLAY_ID} .tw-nc-grid {
          display: grid;
          gap: 14px;
          margin-top: 14px;
        }
        #${OVERLAY_ID} .tw-nc-grid-2 {
          grid-template-columns: 1fr 1fr;
        }
        #${OVERLAY_ID} .tw-nc-grid-4 {
          grid-template-columns: repeat(4, 1fr);
        }
        #${OVERLAY_ID} .tw-nc-inline-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 10px;
        }
        #${OVERLAY_ID} .tw-nc-box,
        #${OVERLAY_ID} .tw-nc-mini-box {
          background: linear-gradient(180deg, #392719 0%, #281b12 100%);
          border: 1px solid #66492c;
          border-radius: 14px;
          padding: 14px;
        }
        #${OVERLAY_ID} .tw-nc-section-title {
          margin: 10px 0 8px;
          color: #fff0d3;
          font-weight: 700;
          font-size: 12px;
        }
        #${OVERLAY_ID} .tw-nc-res-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        #${OVERLAY_ID} .tw-nc-card {
          background: rgba(0,0,0,.18);
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 12px;
          padding: 10px;
          text-align: center;
        }
        #${OVERLAY_ID} .tw-nc-label {
          color: #ceb185;
          font-size: 11px;
        }
        #${OVERLAY_ID} .tw-nc-value {
          margin-top: 6px;
          font-size: 18px;
          font-weight: 800;
          color: #fff7e8;
        }
        #${OVERLAY_ID} .tw-nc-big {
          font-size: 30px;
          font-weight: 800;
          color: #fff;
        }
        #${OVERLAY_ID} .tw-nc-line {
          margin: 4px 0;
          font-size: 13px;
        }
        #${OVERLAY_ID} .tw-nc-form-row {
          display: grid;
          grid-template-columns: 1fr 150px;
          gap: 10px;
          align-items: center;
          margin: 8px 0;
        }
        #${OVERLAY_ID} .tw-nc-form-row input {
          height: 34px;
          padding: 0 10px;
          border-radius: 10px;
          border: 1px solid #725332;
          background: #160f0a;
          color: #f5ead7;
        }
        #${OVERLAY_ID} .tw-nc-check {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
          font-size: 13px;
        }
        #${OVERLAY_ID} .tw-nc-btn {
          height: 36px;
          padding: 0 14px;
          border-radius: 10px;
          border: 1px solid #7d5b33;
          cursor: pointer;
          font-weight: 700;
        }
        #${OVERLAY_ID} .tw-nc-btn-secondary {
          background: linear-gradient(180deg, #4c3622 0%, #342316 100%);
          color: #f5ead7;
        }
        #${OVERLAY_ID} .tw-nc-btn-primary {
          background: linear-gradient(180deg, #bc8a3d 0%, #8d6228 100%);
          color: #fff9ed;
        }
        @media (max-width: 900px) {
          #${OVERLAY_ID} .tw-nc-grid-2,
          #${OVERLAY_ID} .tw-nc-grid-4,
          #${OVERLAY_ID} .tw-nc-inline-grid,
          #${OVERLAY_ID} .tw-nc-res-grid,
          #${OVERLAY_ID} .tw-nc-form-row {
            grid-template-columns: 1fr;
          }
        }
      `;

      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = css;
      document.head.appendChild(style);
    },

    open() {
      this.injectStyle();
      this.refreshDetectedData();
      this.render();
    },

    close() {
      document.getElementById(OVERLAY_ID)?.remove();
    }
  };

  window.__TW_NOBRES_CALCULATOR__ = app;
  app.open();
})();
