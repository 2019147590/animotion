{
  const global = typeof window !== "undefined" ? window : globalThis;
  const Animotion = global.Animotion || (global.Animotion = {});

  function createFixture(options = {}) {
    const definition = options.definition || Animotion.scriptedGengaSampleDefinition.createDefinition();
    const seeded = { ...definition, seed: String(options.seed || definition.seed || definition.id) };
    return Animotion.scriptedGengaRunner.runScriptedGengaDefinition(seeded);
  }

  async function loadIntoApp(options = {}) {
    const fixture = createFixture(options);
    await Animotion.scriptedGengaRunner.loadGeneratedCutIntoApp(fixture);
    if (Animotion.dom?.els?.demoGengaStatus) {
      Animotion.dom.els.demoGengaStatus.textContent = "오리지널 원화 컷 fixture가 sample script로 생성되었습니다.";
    }
    return fixture;
  }

  Animotion.scriptedGengaGenerator = { createFixture, loadIntoApp };
  if (typeof module !== "undefined") module.exports = Animotion.scriptedGengaGenerator;
}
