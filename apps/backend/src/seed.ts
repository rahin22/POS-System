/**
 * Database Seed Script
 * 
 * Run with: npm run db:seed
 * 
 * This creates:
 * - Default admin user
 * - Sample categories
 * - Sample products
 * - Default settings
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // Create default admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@kebabshop.com' },
    update: {},
    create: {
      email: 'admin@kebabshop.com',
      password: adminPassword,
      name: 'Admin',
      role: 'admin',
    },
  });
  console.log(`✅ Admin user created: ${admin.email}`);

  // Create staff user
  const staffPassword = await bcrypt.hash('staff123', 10);
  const staff = await prisma.user.upsert({
    where: { email: 'staff@kebabshop.com' },
    update: {},
    create: {
      email: 'staff@kebabshop.com',
      password: staffPassword,
      name: 'Staff Member',
      role: 'staff',
    },
  });
  console.log(`✅ Staff user created: ${staff.email}`);

  // Create categories
  const categories = [
    { name: 'Kebabs', description: 'Delicious kebabs and wraps', sortOrder: 1 },
    { name: 'Burgers', description: 'Juicy burgers', sortOrder: 2 },
    { name: 'Sides', description: 'Chips, salads and more', sortOrder: 3 },
    { name: 'Drinks', description: 'Cold and hot beverages', sortOrder: 4 },
    { name: 'Desserts', description: 'Sweet treats', sortOrder: 5 },
  ];

  const createdCategories: Record<string, string> = {};
  
  for (const cat of categories) {
    const category = await prisma.category.upsert({
      where: { id: cat.name.toLowerCase() },
      update: cat,
      create: { id: cat.name.toLowerCase(), ...cat },
    });
    createdCategories[cat.name] = category.id;
  }
  console.log(`✅ ${categories.length} categories created`);

  // Create products
  const products = [
    // Kebabs
    { name: 'Doner Kebab Wrap', price: 6.99, categoryId: createdCategories['Kebabs'], sortOrder: 1 },
    { name: 'Chicken Shish Kebab', price: 8.99, categoryId: createdCategories['Kebabs'], sortOrder: 2 },
    { name: 'Lamb Shish Kebab', price: 9.99, categoryId: createdCategories['Kebabs'], sortOrder: 3 },
    { name: 'Mixed Kebab', price: 10.99, categoryId: createdCategories['Kebabs'], sortOrder: 4 },
    { name: 'Kofte Kebab', price: 8.49, categoryId: createdCategories['Kebabs'], sortOrder: 5 },
    { name: 'Adana Kebab', price: 9.49, categoryId: createdCategories['Kebabs'], sortOrder: 6 },
    { name: 'Doner Meat & Chips', price: 7.49, categoryId: createdCategories['Kebabs'], sortOrder: 7 },
    
    // Burgers
    { name: 'Beef Burger', price: 5.99, categoryId: createdCategories['Burgers'], sortOrder: 1 },
    { name: 'Chicken Burger', price: 5.49, categoryId: createdCategories['Burgers'], sortOrder: 2 },
    { name: 'Veggie Burger', price: 5.49, categoryId: createdCategories['Burgers'], sortOrder: 3 },
    { name: 'Double Beef Burger', price: 7.99, categoryId: createdCategories['Burgers'], sortOrder: 4 },
    
    // Sides
    { name: 'Chips (Regular)', price: 2.49, categoryId: createdCategories['Sides'], sortOrder: 1 },
    { name: 'Chips (Large)', price: 3.49, categoryId: createdCategories['Sides'], sortOrder: 2 },
    { name: 'Cheesy Chips', price: 3.99, categoryId: createdCategories['Sides'], sortOrder: 3 },
    { name: 'Onion Rings', price: 2.99, categoryId: createdCategories['Sides'], sortOrder: 4 },
    { name: 'Hummus', price: 2.99, categoryId: createdCategories['Sides'], sortOrder: 5 },
    { name: 'Garlic Bread', price: 2.49, categoryId: createdCategories['Sides'], sortOrder: 6 },
    { name: 'Salad', price: 3.49, categoryId: createdCategories['Sides'], sortOrder: 7 },
    
    // Drinks
    { name: 'Coca Cola', price: 1.49, categoryId: createdCategories['Drinks'], sortOrder: 1 },
    { name: 'Fanta', price: 1.49, categoryId: createdCategories['Drinks'], sortOrder: 2 },
    { name: 'Sprite', price: 1.49, categoryId: createdCategories['Drinks'], sortOrder: 3 },
    { name: 'Water', price: 0.99, categoryId: createdCategories['Drinks'], sortOrder: 4 },
    { name: 'Ayran', price: 1.99, categoryId: createdCategories['Drinks'], sortOrder: 5 },
    
    // Desserts
    { name: 'Baklava', price: 3.99, categoryId: createdCategories['Desserts'], sortOrder: 1 },
    { name: 'Kunefe', price: 4.99, categoryId: createdCategories['Desserts'], sortOrder: 2 },
    { name: 'Ice Cream', price: 2.49, categoryId: createdCategories['Desserts'], sortOrder: 3 },
  ];

  let productCount = 0;
  for (const prod of products) {
    await prisma.product.create({
      data: prod,
    });
    productCount++;
  }
  console.log(`✅ ${productCount} products created`);

  // Create modifier groups
  const sauceGroup = await prisma.modifierGroup.create({
    data: {
      name: 'Sauces',
      description: 'Choose your sauce',
      isRequired: false,
      minSelections: 0,
      maxSelections: 3,
      modifiers: {
        create: [
          { name: 'Garlic Mayo', price: 0 },
          { name: 'Chilli Sauce', price: 0 },
          { name: 'BBQ Sauce', price: 0 },
          { name: 'Yogurt Sauce', price: 0 },
          { name: 'Extra Sauce', price: 0.50 },
        ],
      },
    },
  });
  console.log('✅ Sauce modifiers created');

  const saladGroup = await prisma.modifierGroup.create({
    data: {
      name: 'Salad Options',
      description: 'Customize your salad',
      isRequired: false,
      minSelections: 0,
      maxSelections: 5,
      modifiers: {
        create: [
          { name: 'Lettuce', price: 0 },
          { name: 'Tomato', price: 0 },
          { name: 'Onion', price: 0 },
          { name: 'Cabbage', price: 0 },
          { name: 'Jalapenos', price: 0.50 },
        ],
      },
    },
  });
  console.log('✅ Salad modifiers created');

  const extrasGroup = await prisma.modifierGroup.create({
    data: {
      name: 'Extras',
      description: 'Add extras to your order',
      isRequired: false,
      minSelections: 0,
      maxSelections: 5,
      modifiers: {
        create: [
          { name: 'Extra Cheese', price: 1.00 },
          { name: 'Extra Meat', price: 2.00 },
          { name: 'Halloumi', price: 1.50 },
          { name: 'Bacon', price: 1.50 },
        ],
      },
    },
  });
  console.log('✅ Extra modifiers created');

  // Create default settings
  await prisma.settings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      shopName: 'Kebab House',
      address: '123 High Street\nLondon, UK',
      phone: '020 1234 5678',
      vatRate: 20,
      currency: 'GBP',
      currencySymbol: '£',
      receiptFooter: 'Thank you for your order!\nVisit us again soon!',
    },
  });
  console.log('✅ Default settings created');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📝 Login credentials:');
  console.log('   Admin: admin@kebabshop.com / admin123');
  console.log('   Staff: staff@kebabshop.com / staff123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
