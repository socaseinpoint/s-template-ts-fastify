import { PrismaClient, Role, ItemCategory, ItemStatus } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Hash passwords
  const adminPassword = await bcrypt.hash('Admin123!', 10)
  const moderatorPassword = await bcrypt.hash('Moderator123!', 10)
  const userPassword = await bcrypt.hash('User123!', 10)

  // Create users
  console.log('👥 Creating users...')

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      id: '1',
      email: 'admin@example.com',
      password: adminPassword,
      name: 'Admin User',
      phone: '+1234567890',
      role: Role.ADMIN,
    },
  })

  const moderator = await prisma.user.upsert({
    where: { email: 'moderator@example.com' },
    update: {},
    create: {
      id: '2',
      email: 'moderator@example.com',
      password: moderatorPassword,
      name: 'Moderator User',
      phone: '+1234567891',
      role: Role.MODERATOR,
    },
  })

  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      id: '3',
      email: 'user@example.com',
      password: userPassword,
      name: 'Regular User',
      phone: '+1234567892',
      role: Role.USER,
    },
  })

  console.log(`✓ Created user: ${admin.email} (${admin.role})`)
  console.log(`✓ Created user: ${moderator.email} (${moderator.role})`)
  console.log(`✓ Created user: ${user.email} (${user.role})`)

  // Create items
  console.log('\n📦 Creating items...')

  const item1 = await prisma.item.upsert({
    where: { id: '1' },
    update: {},
    create: {
      id: '1',
      name: 'MacBook Pro M3',
      description: 'Latest MacBook Pro with M3 chip, 16GB RAM, 512GB SSD',
      category: ItemCategory.ELECTRONICS,
      price: 2999.99,
      quantity: 15,
      status: ItemStatus.AVAILABLE,
      tags: ['laptop', 'apple', 'professional', 'portable'],
      userId: admin.id,
    },
  })

  const item2 = await prisma.item.upsert({
    where: { id: '2' },
    update: {},
    create: {
      id: '2',
      name: 'Winter Jacket',
      description: 'Warm winter jacket for cold weather',
      category: ItemCategory.CLOTHING,
      price: 199.99,
      quantity: 50,
      status: ItemStatus.AVAILABLE,
      tags: ['winter', 'warm', 'outdoor'],
      userId: moderator.id,
    },
  })

  const item3 = await prisma.item.upsert({
    where: { id: '3' },
    update: {},
    create: {
      id: '3',
      name: 'TypeScript Handbook',
      description: 'Complete guide to TypeScript programming',
      category: ItemCategory.BOOKS,
      price: 39.99,
      quantity: 100,
      status: ItemStatus.AVAILABLE,
      tags: ['programming', 'typescript', 'education'],
      userId: admin.id,
    },
  })

  const item4 = await prisma.item.upsert({
    where: { id: '4' },
    update: {},
    create: {
      id: '4',
      name: 'Organic Coffee Beans',
      description: 'Premium organic coffee beans from Colombia',
      category: ItemCategory.FOOD,
      price: 24.99,
      quantity: 200,
      status: ItemStatus.AVAILABLE,
      tags: ['coffee', 'organic', 'premium'],
      userId: user.id,
    },
  })

  const item5 = await prisma.item.upsert({
    where: { id: '5' },
    update: {},
    create: {
      id: '5',
      name: 'Gaming Mouse',
      description: 'RGB gaming mouse with 16000 DPI',
      category: ItemCategory.ELECTRONICS,
      price: 79.99,
      quantity: 0,
      status: ItemStatus.OUT_OF_STOCK,
      tags: ['gaming', 'mouse', 'rgb'],
      userId: admin.id,
    },
  })

  console.log(`✓ Created item: ${item1.name}`)
  console.log(`✓ Created item: ${item2.name}`)
  console.log(`✓ Created item: ${item3.name}`)
  console.log(`✓ Created item: ${item4.name}`)
  console.log(`✓ Created item: ${item5.name}`)

  console.log('\n✅ Database seeded successfully!')
  console.log('\n📊 Summary:')
  console.log(`   Users: 3`)
  console.log(`   Items: 5`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
