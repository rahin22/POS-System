const { PrismaClient } = require('@prisma/client');

// Sydney database (source)
const sydneyDb = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres.vwoxhvowfcgxcnslxaua:xs6h78St7KPxYyPD@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&statement_cache_size=0'
    }
  }
});

// Singapore database (destination)
const singaporeDb = new PrismaClient();

async function migrateProductModifierGroups() {
  try {
    console.log('🔄 Migrating ProductModifierGroup relationships...\n');

    // Query the explicit junction table from Sydney
    const relations = await sydneyDb.productModifierGroup.findMany();

    console.log(`Found ${relations.length} product-modifierGroup relationships\n`);

    if (relations.length === 0) {
      console.log('✅ No relationships to migrate');
      return;
    }

    // Insert into Singapore
    for (const relation of relations) {
      await singaporeDb.productModifierGroup.upsert({
        where: {
          productId_modifierGroupId: {
            productId: relation.productId,
            modifierGroupId: relation.modifierGroupId
          }
        },
        update: {},
        create: {
          productId: relation.productId,
          modifierGroupId: relation.modifierGroupId
        }
      });
      console.log(`✓ Linked product ${relation.productId} → modifierGroup ${relation.modifierGroupId}`);
    }

    console.log('\n🎉 ProductModifierGroup relationships migrated successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sydneyDb.$disconnect();
    await singaporeDb.$disconnect();
  }
}

migrateProductModifierGroups();
