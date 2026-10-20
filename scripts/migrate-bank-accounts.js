/**
 * Script de migración: asigna aleatoriamente una cuenta bancaria
 * a cada pedido que no tenga una.
 *
 * Uso:
 *   node scripts/migrate-bank-accounts.js
 *
 * ⚠️ IMPORTANTE: Ejecutar SOLO en local (base de datos de pruebas).
 *   No ejecutar en producción.
 */

const { createStrapi, compileStrapi } = require("@strapi/strapi");

async function main() {
  console.log("🚀 Iniciando script de migración...");

  // Inicializar Strapi
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  try {
    // 1. Obtener todas las cuentas activas
    const bankAccounts = await app
      .documents("api::bank-account.bank-account")
      .findMany({
        filters: { active: { $eq: true } },
      });

    if (bankAccounts.length === 0) {
      console.error("❌ No hay cuentas bancarias activas. Crea al menos una.");
      return;
    }

    console.log(`✅ ${bankAccounts.length} cuentas activas encontradas:`);
    for (const account of bankAccounts) {
      console.log(`   - ${account.name} (${account.documentId})`);
    }

    // 2. Obtener todos los pedidos sin cuenta
    const ordersWithoutAccount = await app
      .documents("api::order.order")
      .findMany({
        filters: {
          bankAccount: { $null: true },
          cancelled: { $eq: false },
        },
        fields: ["documentId", "code", "total"],
      });

    console.log(
      `\n📦 ${ordersWithoutAccount.length} pedidos sin cuenta bancaria.`,
    );

    if (ordersWithoutAccount.length === 0) {
      console.log("✅ No hay pedidos pendientes de migrar.");
      return;
    }

    // 3. Asignar aleatoriamente una cuenta a cada pedido
    let updated = 0;
    let errors = 0;

    for (const order of ordersWithoutAccount) {
      const randomAccount =
        bankAccounts[Math.floor(Math.random() * bankAccounts.length)];

      try {
        await app.documents("api::order.order").update({
          documentId: order.documentId,
          data: {
            bankAccount: randomAccount.documentId,
            paymentStatus: "paid",
          },
        });

        updated++;

        if (updated % 100 === 0) {
          console.log(
            `   ⏳ ${updated}/${ordersWithoutAccount.length} actualizados...`,
          );
        }
      } catch (err) {
        errors++;
        console.error(`❌ Error al actualizar ${order.code}: ${err.message}`);
      }
    }

    console.log(`\n🎉 Migración completada:`);
    console.log(`   ✅ Actualizados: ${updated}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log(`   📊 Total: ${ordersWithoutAccount.length}`);
  } catch (error) {
    console.error("❌ Error durante la migración:", error);
  } finally {
    await app.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
