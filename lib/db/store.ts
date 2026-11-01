import fs from 'fs';
import path from 'path';
import type {
  CategoryRecord,
  DatabaseSchema,
  FoodItemRecord,
  RestaurantRecord,
  SupportTicketCategory,
  SupportTicketReferenceRecord,
  UserRole,
} from './models';
import {
  generateTicketAccessToken,
  getDefaultYantraSecrets,
  hashPassword,
  computeYantraWebhookSignature,
} from './security';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'foodhub-db.json');

declare global {
  var _foodhubDbCache: DatabaseSchema | undefined;
}

function buildSeedCatalog(now: string): {
  categories: CategoryRecord[];
  restaurants: RestaurantRecord[];
  foodItems: FoodItemRecord[];
} {
  const categories: CategoryRecord[] = [
    {
      id: 'cat_pizza',
      name: 'Pizza',
      slug: 'pizza',
      description: 'Wood-fired Neapolitan sourdough pizzas & cheesy slices',
      image: '/images/dish-pizza.svg',
      isActive: true,
      createdAt: now,
    },
    {
      id: 'cat_burgers',
      name: 'Burger',
      slug: 'burger',
      description: 'Seared smash burgers, crispy chicken & brioche sliders',
      image: '/images/dish-burger.svg',
      isActive: true,
      createdAt: now,
    },
    {
      id: 'cat_biryani',
      name: 'Biryani',
      slug: 'biryani',
      description: 'Slow-cooked royal dum biryanis sealed in copper handis',
      image: '/images/dish-biryani.svg',
      isActive: true,
      createdAt: now,
    },
    {
      id: 'cat_south_indian',
      name: 'South Indian',
      slug: 'south-indian',
      description: 'Crispy ghee roast dosas, fluffy idlis & filter coffee',
      image: '/images/dish-south-indian.svg',
      isActive: true,
      createdAt: now,
    },
    {
      id: 'cat_north_indian',
      name: 'North Indian',
      slug: 'north-indian',
      description: 'Velvety makhani gravies, smoky tandoori kebabs & garlic naan',
      image: '/images/dish-north-indian.svg',
      isActive: true,
      createdAt: now,
    },
    {
      id: 'cat_chinese',
      name: 'Chinese',
      slug: 'chinese',
      description: 'Wok-tossed Hakka noodles, handcrafted dimsum & Sichuan bowls',
      image: '/images/dish-chinese.svg',
      isActive: true,
      createdAt: now,
    },
    {
      id: 'cat_desserts',
      name: 'Desserts',
      slug: 'desserts',
      description: 'Molten chocolate lava fondants, tiramisu & warm waffles',
      image: '/images/dish-dessert.svg',
      isActive: true,
      createdAt: now,
    },
    {
      id: 'cat_cakes',
      name: 'Cakes',
      slug: 'cakes',
      description: 'Belgian truffle celebration cakes, cheesecakes & pastries',
      image: '/images/dish-cake.svg',
      isActive: true,
      createdAt: now,
    },
    {
      id: 'cat_ice_cream',
      name: 'Ice Cream',
      slug: 'ice-cream',
      description: 'Small-batch Italian gelato, sundaes & artisan sorbets',
      image: '/images/dish-ice-cream.svg',
      isActive: true,
      createdAt: now,
    },
    {
      id: 'cat_beverages',
      name: 'Beverages',
      slug: 'beverages',
      description: 'Cold-pressed juices, mango lassi, boba & craft coolers',
      image: '/images/dish-beverage.svg',
      isActive: true,
      createdAt: now,
    },
  ];

  const allServiceableZones = [
    'Downtown San Francisco',
    'Mission District',
    'SoMa',
    'Marina District',
    'Castro',
    'Pacific Heights',
  ];

  const restaurants: RestaurantRecord[] = [
    {
      id: 'rest_1',
      ownerId: 'usr_restaurant_1',
      name: 'Forno Di Pietra Kitchen',
      description:
        '72-hour fermented Neapolitan sourdough pizzas, truffle burrata plates, and wood-fired small plates.',
      cuisine: ['Pizza', 'Italian', 'Desserts', 'Beverages'],
      image: '/images/dish-pizza.svg',
      address: '420 Valencia Street, Mission District, San Francisco, CA 94103',
      phone: '+1 (415) 890-4400',
      openingHours: '10:30 AM – 11:30 PM',
      isAvailable: true,
      isApproved: true,
      rating: 4.8,
      reviewCount: 342,
      deliveryTimeMinutes: 25,
      minOrderAmount: 15,
      deliveryFee: 2.99,
      featured: true,
      costForTwo: 38,
      isPureVeg: false,
      offerBadge: '50% OFF up to $12',
      serviceableZones: allServiceableZones,
      isRecommended: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'rest_2',
      ownerId: 'usr_restaurant_1',
      name: 'Zaffran Royal Handi House',
      description:
        'Authentic slow-steamed Awadhi & Hyderabadi dum biryanis, smoky North Indian curries, and saffron kebabs.',
      cuisine: ['Biryani', 'North Indian', 'Desserts', 'Beverages'],
      image: '/images/dish-biryani.svg',
      address: '785 Market Street, SoMa, San Francisco, CA 94102',
      phone: '+1 (415) 890-4402',
      openingHours: '11:00 AM – 11:30 PM',
      isAvailable: true,
      isApproved: true,
      rating: 4.9,
      reviewCount: 518,
      deliveryTimeMinutes: 28,
      minOrderAmount: 18,
      deliveryFee: 1.99,
      featured: true,
      costForTwo: 34,
      isPureVeg: false,
      offerBadge: 'FREE DELIVERY',
      serviceableZones: allServiceableZones,
      isRecommended: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'rest_3',
      ownerId: 'usr_restaurant_1',
      name: 'Ironclad Smash & Craft Grill',
      description:
        'Crispy lacy-edged Wagyu smash burgers, smoked chipotle aioli, loaded starters, and hand-spun shakes.',
      cuisine: ['Burger', 'American', 'Beverages'],
      image: '/images/dish-burger.svg',
      address: '1120 Columbus Ave, Marina District, San Francisco, CA 94133',
      phone: '+1 (415) 890-4403',
      openingHours: '11:00 AM – 12:00 AM',
      isAvailable: true,
      isApproved: true,
      rating: 4.7,
      reviewCount: 289,
      deliveryTimeMinutes: 20,
      minOrderAmount: 12,
      deliveryFee: 0,
      featured: true,
      costForTwo: 30,
      isPureVeg: false,
      offerBadge: 'FLAT $10 OFF',
      serviceableZones: allServiceableZones,
      isRecommended: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'rest_4',
      ownerId: 'usr_restaurant_1',
      name: 'Atelier Cacao, Cakes & Gelato',
      description:
        '100% Pure Vegetarian French patisserie crafting Belgian chocolate cakes, molten fondants, and small-batch gelato.',
      cuisine: ['Desserts', 'Cakes', 'Ice Cream', 'Beverages'],
      image: '/images/dish-cake.svg',
      address: '2150 Fillmore Street, Pacific Heights, San Francisco, CA 94115',
      phone: '+1 (415) 890-4404',
      openingHours: '09:00 AM – 10:30 PM',
      isAvailable: true,
      isApproved: true,
      rating: 4.9,
      reviewCount: 264,
      deliveryTimeMinutes: 22,
      minOrderAmount: 10,
      deliveryFee: 1.49,
      featured: true,
      costForTwo: 24,
      isPureVeg: true,
      offerBadge: '20% OFF DESSERTS',
      serviceableZones: allServiceableZones,
      isRecommended: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'rest_5',
      ownerId: 'usr_restaurant_1',
      name: 'Dakshin Tiffin & Filter House',
      description:
        '100% Pure Vegetarian South Indian kitchen serving crispy Benne Masala Dosas, Ghee Podi Idlis, and degree filter coffee.',
      cuisine: ['South Indian', 'North Indian', 'Beverages'],
      image: '/images/dish-south-indian.svg',
      address: '590 Valencia Street, Mission District, San Francisco, CA 94110',
      phone: '+1 (415) 890-4405',
      openingHours: '08:00 AM – 10:30 PM',
      isAvailable: true,
      isApproved: true,
      rating: 4.8,
      reviewCount: 412,
      deliveryTimeMinutes: 19,
      minOrderAmount: 12,
      deliveryFee: 0,
      featured: true,
      costForTwo: 22,
      isPureVeg: true,
      offerBadge: 'FREE DELIVERY + 30% OFF',
      serviceableZones: allServiceableZones,
      isRecommended: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'rest_6',
      ownerId: 'usr_restaurant_1',
      name: 'Red Lantern Wok & Dimsum Bar',
      description:
        'High-flame Sichuan wok noodles, handmade crystal har gow dimsum, crispy chili lotus stem, and iced fruit teas.',
      cuisine: ['Chinese', 'Asian', 'Beverages', 'Desserts'],
      image: '/images/dish-chinese.svg',
      address: '840 Grant Avenue, Downtown San Francisco, CA 94108',
      phone: '+1 (415) 890-4406',
      openingHours: '11:30 AM – 11:30 PM',
      isAvailable: true,
      isApproved: true,
      rating: 4.6,
      reviewCount: 238,
      deliveryTimeMinutes: 26,
      minOrderAmount: 15,
      deliveryFee: 2.49,
      featured: false,
      costForTwo: 32,
      isPureVeg: false,
      offerBadge: '50% OFF up to $12',
      serviceableZones: allServiceableZones,
      isRecommended: false,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const foodItems: FoodItemRecord[] = [
    // REST 1: Forno Di Pietra Kitchen
    {
      id: 'food_1',
      restaurantId: 'rest_1',
      categoryId: 'cat_pizza',
      name: 'Truffle Burrata & Wild Mushroom Sourdough Pizza',
      description:
        'San Marzano tomato base, creamy Pugliese burrata, roasted chanterelles, black truffle oil, and fresh sweet basil.',
      price: 22.5,
      image: '/images/dish-pizza.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: true,
      isBestseller: true,
      menuSection: 'Recommended',
      customizations: [
        {
          id: 'cust_crust_1',
          title: 'Size & Crust Selection',
          required: true,
          options: [
            { name: 'Regular 10" Sourdough', price: 0 },
            { name: 'Medium 12" Charred Garlic Herb Crust', price: 2.5 },
            { name: 'Large 14" Artisanal Wood-Fired', price: 5.0 },
          ],
        },
        {
          id: 'cust_top_1',
          title: 'Extra Toppings & Add-Ons',
          required: false,
          options: [
            { name: 'Extra Whole Burrata Ball', price: 4.5 },
            { name: 'Calabrian Chili Honey Drizzle', price: 1.5 },
            { name: 'Shaved Black Summer Truffle', price: 3.5 },
          ],
        },
      ],
      rating: 4.9,
      reviewCount: 148,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_2',
      restaurantId: 'rest_1',
      categoryId: 'cat_pizza',
      name: 'Diavola Piccante & Hot Honey Pizza',
      description:
        'Wood-fired sourdough topped with Fior di Latte mozzarella, crispy artisanal pepperoni, crushed red chili, and wildflower hot honey.',
      price: 24.0,
      image: '/images/dish-pizza.svg',
      isVeg: false,
      isAvailable: true,
      isPopular: true,
      isBestseller: true,
      menuSection: 'Pizza and Burgers',
      customizations: [
        {
          id: 'cust_crust_2',
          title: 'Size & Crust Selection',
          required: true,
          options: [
            { name: 'Classic 12" Sourdough', price: 0 },
            { name: 'Stuffed Smoked Mozzarella Edge', price: 3.5 },
          ],
        },
        {
          id: 'cust_spice_2',
          title: 'Spice Level',
          required: true,
          options: [
            { name: 'Mild Pepperoni', price: 0 },
            { name: 'Medium Calabrian Chili', price: 0 },
            { name: 'Fiery Diavola + Extra Hot Honey', price: 1.0 },
          ],
        },
      ],
      rating: 4.8,
      reviewCount: 112,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_101',
      restaurantId: 'rest_1',
      categoryId: 'cat_pizza',
      name: 'Wood-Fired Garlic Rosemary Focaccia & Burrata Dip',
      description:
        'Blistered sourdough focaccia brushed with extra-virgin olive oil, sea salt, and whipped ricotta-pesto dip.',
      price: 12.0,
      image: '/images/dish-pizza.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: false,
      isBestseller: false,
      menuSection: 'Starters',
      customizations: [
        {
          id: 'cust_dip_101',
          title: 'Add-on Dips',
          required: false,
          options: [
            { name: 'Sun-Dried Tomato Tapenade', price: 1.5 },
            { name: 'Truffle Aioli Dip', price: 2.0 },
          ],
        },
      ],
      rating: 4.7,
      reviewCount: 68,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_3',
      restaurantId: 'rest_1',
      categoryId: 'cat_desserts',
      name: 'Classic Espresso Mascarpone Tiramisu',
      description:
        'Savoiardi ladyfingers soaked in single-origin espresso, layered with whipped mascarpone zabaglione and Valrhona cocoa.',
      price: 11.5,
      image: '/images/dish-dessert.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: true,
      isBestseller: true,
      menuSection: 'Desserts',
      customizations: [],
      rating: 4.9,
      reviewCount: 74,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_102',
      restaurantId: 'rest_1',
      categoryId: 'cat_beverages',
      name: 'Sicilian Blood Orange & Basil Sparkling Cooler',
      description:
        'Freshly pressed Sicilian blood orange juice muddled with sweet basil leaves and San Pellegrino sparkling water.',
      price: 6.5,
      image: '/images/dish-beverage.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: false,
      isBestseller: false,
      menuSection: 'Beverages',
      customizations: [
        {
          id: 'cust_ice_102',
          title: 'Ice Preference',
          required: true,
          options: [
            { name: 'Regular Ice', price: 0 },
            { name: 'Less Ice', price: 0 },
          ],
        },
      ],
      rating: 4.8,
      reviewCount: 51,
      createdAt: now,
      updatedAt: now,
    },

    // REST 2: Zaffran Royal Handi House
    {
      id: 'food_4',
      restaurantId: 'rest_2',
      categoryId: 'cat_biryani',
      name: 'Royal Zafrani Chicken Dum Biryani',
      description:
        'Long-grain aged basmati rice and succulent spiced chicken slow-cooked in a sealed copper handi with Kashmiri saffron, mint, and crispy birista.',
      price: 19.5,
      image: '/images/dish-biryani.svg',
      isVeg: false,
      isAvailable: true,
      isPopular: true,
      isBestseller: true,
      menuSection: 'Rice and Biryani',
      customizations: [
        {
          id: 'cust_size_4',
          title: 'Portion Size',
          required: true,
          options: [
            { name: 'Regular Handi (Serves 1-2)', price: 0 },
            { name: 'Royal Family Handi (Serves 3)', price: 9.0 },
          ],
        },
        {
          id: 'cust_spice_4',
          title: 'Spice Calibration',
          required: true,
          options: [
            { name: 'Aromatic Mild', price: 0 },
            { name: 'Authentic Medium', price: 0 },
            { name: 'Fiery Hyderabadi', price: 0.5 },
          ],
        },
        {
          id: 'cust_side_4',
          title: 'Accompaniments',
          required: false,
          options: [
            { name: 'Burhani Garlic Raita + Mirchi Ka Salan', price: 2.5 },
            { name: 'Extra Saffron Egg (2 pcs)', price: 2.0 },
          ],
        },
      ],
      rating: 4.9,
      reviewCount: 265,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_5',
      restaurantId: 'rest_2',
      categoryId: 'cat_biryani',
      name: 'Subz Paneer & Roasted Cashew Handi Biryani',
      description:
        'Char-grilled malai paneer cubes, baby potatoes, and golden cashews layered with rose-water and saffron infused basmati rice.',
      price: 17.5,
      image: '/images/dish-biryani.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: true,
      isBestseller: true,
      menuSection: 'Recommended',
      customizations: [
        {
          id: 'cust_spice_5',
          title: 'Spice Calibration',
          required: true,
          options: [
            { name: 'Aromatic Mild', price: 0 },
            { name: 'Authentic Medium', price: 0 },
          ],
        },
      ],
      rating: 4.8,
      reviewCount: 184,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_103',
      restaurantId: 'rest_2',
      categoryId: 'cat_north_indian',
      name: 'Old Delhi Smoked Butter Chicken & Garlic Naan Combo',
      description:
        'Charcoal-smoked tandoori chicken tikka simmered in velvety tomato-fenugreek makhani gravy, served with 2 butter garlic naans.',
      price: 21.0,
      image: '/images/dish-north-indian.svg',
      isVeg: false,
      isAvailable: true,
      isPopular: true,
      isBestseller: true,
      menuSection: 'Main Course',
      customizations: [
        {
          id: 'cust_bread_103',
          title: 'Artisanal Bread Selection',
          required: true,
          options: [
            { name: '2 Roasted Garlic Butter Naans', price: 0 },
            { name: '2 Flaky Lachha Parathas', price: 1.5 },
            { name: 'Cheese & Chili Kulcha', price: 2.5 },
          ],
        },
      ],
      rating: 4.9,
      reviewCount: 219,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_104',
      restaurantId: 'rest_2',
      categoryId: 'cat_north_indian',
      name: 'Peshawari Malai Paneer Tikka (6 Pcs)',
      description:
        'Cottage cheese marinated in hung curd, crushed black pepper, green cardamom, and charred in a clay tandoor with mint chutney.',
      price: 14.5,
      image: '/images/dish-north-indian.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: false,
      isBestseller: false,
      menuSection: 'Starters',
      customizations: [],
      rating: 4.8,
      reviewCount: 94,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_105',
      restaurantId: 'rest_2',
      categoryId: 'cat_beverages',
      name: 'Alphonso Mango & Saffron Pistachio Lassi',
      description:
        'Thick churned artisanal yogurt blended with Ratnagiri Alphonso mango pulp, saffron strands, and toasted pistachios.',
      price: 6.99,
      image: '/images/dish-beverage.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: true,
      isBestseller: false,
      menuSection: 'Beverages',
      customizations: [],
      rating: 4.9,
      reviewCount: 142,
      createdAt: now,
      updatedAt: now,
    },

    // REST 3: Ironclad Smash & Craft Grill
    {
      id: 'food_6',
      restaurantId: 'rest_3',
      categoryId: 'cat_burgers',
      name: 'Double Wagyu Truffle Smash Burger',
      description:
        'Two seared wagyu smash patties, aged Vermont white cheddar, caramelized Vidalia onions, black garlic aioli on a toasted potato brioche bun.',
      price: 18.0,
      image: '/images/dish-burger.svg',
      isVeg: false,
      isAvailable: true,
      isPopular: true,
      isBestseller: true,
      menuSection: 'Bestseller',
      customizations: [
        {
          id: 'cust_side_6',
          title: 'Side Selection',
          required: true,
          options: [
            { name: 'Rosemary Sea-Salt Fries', price: 0 },
            { name: 'Truffle Parmesan Fries', price: 2.5 },
            { name: 'Crispy Onion Rings', price: 2.0 },
          ],
        },
        {
          id: 'cust_addon_6',
          title: 'Burger Add-Ons',
          required: false,
          options: [
            { name: 'Extra Aged Cheddar Slice', price: 1.5 },
            { name: 'Crispy Smoked Turkey Bacon', price: 2.5 },
            { name: 'Pickled Jalapeños', price: 1.0 },
          ],
        },
      ],
      rating: 4.8,
      reviewCount: 192,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_7',
      restaurantId: 'rest_3',
      categoryId: 'cat_burgers',
      name: 'Crispy Avocado & Halloumi Brioche Burger',
      description:
        'Panko-crusted avocado wedges, griddled Cypriot halloumi cheese, pickled jalapeño slaw, and smoky chipotle glaze.',
      price: 16.5,
      image: '/images/dish-burger.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: true,
      isBestseller: false,
      menuSection: 'Pizza and Burgers',
      customizations: [
        {
          id: 'cust_side_7',
          title: 'Side Selection',
          required: true,
          options: [
            { name: 'Rosemary Sea-Salt Fries', price: 0 },
            { name: 'Sweet Potato Waffle Fries', price: 2.0 },
          ],
        },
      ],
      rating: 4.7,
      reviewCount: 97,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_106',
      restaurantId: 'rest_3',
      categoryId: 'cat_burgers',
      name: 'Nashville Hot Crispy Chicken Tenders (5 Pcs)',
      description:
        'Buttermilk-brined chicken tenders dusted in cayenne-brown sugar spice with house ranch and dill pickles.',
      price: 13.5,
      image: '/images/dish-burger.svg',
      isVeg: false,
      isAvailable: true,
      isPopular: false,
      isBestseller: false,
      menuSection: 'Starters',
      customizations: [],
      rating: 4.7,
      reviewCount: 83,
      createdAt: now,
      updatedAt: now,
    },

    // REST 4: Atelier Cacao, Cakes & Gelato
    {
      id: 'food_8',
      restaurantId: 'rest_4',
      categoryId: 'cat_desserts',
      name: '70% Valrhona Molten Chocolate Fondant',
      description:
        'Warm dark chocolate lava cake with a liquid ganache center, served with Madagascar vanilla bean crème anglaise and fresh raspberries.',
      price: 13.5,
      image: '/images/dish-dessert.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: true,
      isBestseller: true,
      menuSection: 'Bestseller',
      customizations: [
        {
          id: 'cust_scoop_8',
          title: 'Gelato Pairing',
          required: false,
          options: [
            { name: 'Add Madagascar Vanilla Bean Gelato Scoop', price: 3.0 },
            { name: 'Add Sicilian Pistachio Gelato Scoop', price: 3.5 },
          ],
        },
      ],
      rating: 4.9,
      reviewCount: 130,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_107',
      restaurantId: 'rest_4',
      categoryId: 'cat_cakes',
      name: 'Belgian Hazelnut Praline Gateau Cake (500g)',
      description:
        'Three layers of moist chocolate sponge, crispy feuilletine hazelnut praline crunch, and silky Belgian dark chocolate ganache.',
      price: 26.0,
      image: '/images/dish-cake.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: true,
      isBestseller: true,
      menuSection: 'Desserts',
      customizations: [
        {
          id: 'cust_cake_107',
          title: 'Cake Weight & Plaque',
          required: true,
          options: [
            { name: '500g (4-6 Slices)', price: 0 },
            { name: '1 Kg Celebration Size (10-12 Slices)', price: 18.0 },
          ],
        },
      ],
      rating: 4.9,
      reviewCount: 156,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_108',
      restaurantId: 'rest_4',
      categoryId: 'cat_ice_cream',
      name: 'Trio Artisanal Italian Gelato Tub (3 Scoops)',
      description:
        'Hand-churned Bronte pistachio, Piedmont dark hazelnut, and wild strawberry sorbetto in an insulated tub with waffle cones.',
      price: 14.0,
      image: '/images/dish-ice-cream.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: true,
      isBestseller: false,
      menuSection: 'Recommended',
      customizations: [
        {
          id: 'cust_top_108',
          title: 'Artisanal Toppings',
          required: false,
          options: [
            { name: 'Warm Belgian Hot Fudge', price: 1.5 },
            { name: 'Roasted Almond Praline Crumble', price: 1.5 },
          ],
        },
      ],
      rating: 4.8,
      reviewCount: 118,
      createdAt: now,
      updatedAt: now,
    },

    // REST 5: Dakshin Tiffin & Filter House
    {
      id: 'food_109',
      restaurantId: 'rest_5',
      categoryId: 'cat_south_indian',
      name: 'Davangere Benne Ghee Roast Masala Dosa',
      description:
        'Golden crispy fermented rice-lentil crepe roasted in farm white butter, spiced potato palya, gunpowder podi, and 3 chutneys + sambar.',
      price: 13.99,
      image: '/images/dish-south-indian.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: true,
      isBestseller: true,
      menuSection: 'Recommended',
      customizations: [
        {
          id: 'cust_dosa_109',
          title: 'Ghee & Podi Customizations',
          required: false,
          options: [
            { name: 'Extra Homemade Ghee Drizzle', price: 1.5 },
            { name: 'Add Mysore Molagapodi Spice Rub', price: 1.0 },
          ],
        },
      ],
      rating: 4.9,
      reviewCount: 310,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_110',
      restaurantId: 'rest_5',
      categoryId: 'cat_south_indian',
      name: 'Ghee Podi Thatte Idli & Crispy Medu Vada Platter',
      description:
        'Fluffy steamed rice cakes tossed in sesame-lentil gunpowder and cow ghee alongside two crunchy lentil doughnut vadas.',
      price: 11.99,
      image: '/images/dish-south-indian.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: true,
      isBestseller: true,
      menuSection: 'Bestseller',
      customizations: [],
      rating: 4.8,
      reviewCount: 189,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_111',
      restaurantId: 'rest_5',
      categoryId: 'cat_beverages',
      name: 'Kumbakonam Brass Davara Filter Coffee (Flask)',
      description:
        'Slow-percolated Chikmagalur Arabica & chicory decoction frothed with boiling farm milk, served in a thermal travel flask.',
      price: 5.5,
      image: '/images/dish-beverage.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: true,
      isBestseller: false,
      menuSection: 'Beverages',
      customizations: [
        {
          id: 'cust_sugar_111',
          title: 'Sweetness Level',
          required: true,
          options: [
            { name: 'Traditional Organic Jaggery', price: 0.5 },
            { name: 'Classic Cane Sugar', price: 0 },
            { name: 'No Sugar', price: 0 },
          ],
        },
      ],
      rating: 4.9,
      reviewCount: 205,
      createdAt: now,
      updatedAt: now,
    },

    // REST 6: Red Lantern Wok & Dimsum Bar
    {
      id: 'food_112',
      restaurantId: 'rest_6',
      categoryId: 'cat_chinese',
      name: 'Sichuan Chili Oil Hakka Noodles & Crispy Manchurian Bowl',
      description:
        'High-flame wok-tossed noodles with charred bok choy, scallions, house chili crisp, and glazed vegetable manchurian dumplings.',
      price: 16.99,
      image: '/images/dish-chinese.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: true,
      isBestseller: true,
      menuSection: 'Main Course',
      customizations: [
        {
          id: 'cust_spice_112',
          title: 'Wok Spice Level',
          required: true,
          options: [
            { name: 'Mild Garlic Soy', price: 0 },
            { name: 'Medium Sichuan Chili Crisp', price: 0 },
            { name: 'Extra Numbing Mala Peppercorn', price: 1.0 },
          ],
        },
      ],
      rating: 4.7,
      reviewCount: 164,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'food_113',
      restaurantId: 'rest_6',
      categoryId: 'cat_chinese',
      name: 'Steamed Truffle Edamame & Shiitake Crystal Dimsum (6 Pcs)',
      description:
        'Translucent hand-pleated wheat-starch dumplings filled with sweet edamame, roasted shiitake, water chestnuts, and white truffle oil.',
      price: 14.5,
      image: '/images/dish-chinese.svg',
      isVeg: true,
      isAvailable: true,
      isPopular: true,
      isBestseller: true,
      menuSection: 'Starters',
      customizations: [],
      rating: 4.8,
      reviewCount: 122,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return { categories, restaurants, foodItems };
}

function buildInitialSeedData(): DatabaseSchema {
  const now = new Date().toISOString();
  const secrets = getDefaultYantraSecrets();
  const { categories, restaurants, foodItems } = buildSeedCatalog(now);

  const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@gmail.com';
  const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'admin@123';
  const initialAdminTotpSecret = process.env.INITIAL_ADMIN_TOTP_SECRET || 'JBSWY3DPEHPK3PXP';

  const users = [
    {
      id: 'usr_customer_1',
      name: 'Aarav Sharma',
      username: 'aarav',
      email: 'customer@foodhub.com',
      passwordHash: hashPassword('Password123!'),
      phone: '+1 (415) 890-2311',
      role: 'customer' as UserRole,
      allowedWorkspaces: ['customer' as const],
      mfaEnabled: false,
      mfaSecret: null,
      recoveryCodes: [],
      favorites: ['rest_1', 'rest_2', 'rest_5'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr_admin_default',
      name: 'FoodHub Admin (admin@gmail.com)',
      username: 'admin',
      email: initialAdminEmail,
      passwordHash: hashPassword(initialAdminPassword),
      phone: '+1 (415) 890-9999',
      role: 'admin' as UserRole,
      allowedWorkspaces: ['admin' as const],
      mfaEnabled: false,
      mfaSecret: initialAdminTotpSecret,
      recoveryCodes: ['FH26-9901', 'FH26-9902', 'FH26-9903', 'FH26-9904'],
      favorites: [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr_admin_1',
      name: 'Elena Rostova (Admin)',
      username: 'elena_admin',
      email: 'admin@foodhub.com',
      passwordHash: hashPassword('Password123!'),
      phone: '+1 (415) 890-9900',
      role: 'admin' as UserRole,
      allowedWorkspaces: ['admin' as const],
      mfaEnabled: true,
      mfaSecret: initialAdminTotpSecret,
      recoveryCodes: ['FH26-9901', 'FH26-9902', 'FH26-9903', 'FH26-9904'],
      favorites: [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'usr_dual_1',
      name: 'Vikram Mehta (Dual Workspace)',
      username: 'dual_admin',
      email: 'dual@foodhub.com',
      passwordHash: hashPassword('Password123!'),
      phone: '+1 (415) 890-8800',
      role: 'admin' as UserRole,
      allowedWorkspaces: ['customer' as const, 'admin' as const],
      mfaEnabled: true,
      mfaSecret: initialAdminTotpSecret,
      recoveryCodes: ['DUAL-1001', 'DUAL-1002', 'DUAL-1003'],
      favorites: ['rest_1'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const addresses = [
    {
      id: 'addr_1',
      userId: 'usr_customer_1',
      label: 'Home' as const,
      recipientName: 'Aarav Sharma',
      phone: '+1 (415) 890-2311',
      street: '742 Evergreen Terrace, Apt 4B, Mission District',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94107',
      instructions: 'Gate code #4821 — leave at front concierge desk if busy.',
      isDefault: true,
      createdAt: now,
    },
    {
      id: 'addr_2',
      userId: 'usr_customer_1',
      label: 'Work' as const,
      recipientName: 'Aarav Sharma',
      phone: '+1 (415) 890-2311',
      street: '500 Howard Street, Floor 14, SoMa',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      instructions: 'Call on arrival at the South Lobby.',
      isDefault: false,
      createdAt: now,
    },
  ];

  const coupons = [
    {
      id: 'cpn_1',
      code: 'WELCOME50',
      description: '50% off your food order (up to $12 discount on orders $15+)',
      discountType: 'percentage' as const,
      discountValue: 50,
      minOrderValue: 15,
      maxDiscount: 12,
      isActive: true,
      expiresAt: '2027-12-31T23:59:59.000Z',
      usageCount: 18,
      createdAt: now,
    },
    {
      id: 'cpn_2',
      code: 'FREEDEL',
      description: 'Zero delivery fee on orders above $15',
      discountType: 'free_delivery' as const,
      discountValue: 100,
      minOrderValue: 15,
      maxDiscount: 10,
      isActive: true,
      expiresAt: '2027-12-31T23:59:59.000Z',
      usageCount: 42,
      createdAt: now,
    },
    {
      id: 'cpn_3',
      code: 'FEAST10',
      description: 'Flat $10 off on gourmet orders above $35',
      discountType: 'fixed' as const,
      discountValue: 10,
      minOrderValue: 35,
      maxDiscount: 10,
      isActive: true,
      expiresAt: '2027-12-31T23:59:59.000Z',
      usageCount: 9,
      createdAt: now,
    },
    {
      id: 'cpn_4',
      code: 'VEG30',
      description: '30% off Pure Veg & South Indian delicacies (up to $8)',
      discountType: 'percentage' as const,
      discountValue: 30,
      minOrderValue: 12,
      maxDiscount: 8,
      isActive: true,
      expiresAt: '2027-12-31T23:59:59.000Z',
      usageCount: 27,
      createdAt: now,
    },
  ];

  const deliveryPartners = [
    {
      id: 'dp_1',
      userId: 'usr_delivery_1',
      name: 'Rohan Verma',
      phone: '+1 (415) 890-7788',
      email: 'rider@foodhub.com',
      vehicleType: 'Electric Bike' as const,
      vehicleNumber: 'CA-EV-8842',
      isAvailable: true,
      currentZone: 'Mission & SoMa District',
      totalDeliveries: 148,
      rating: 4.9,
      earningsTotal: 1842.5,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const sampleOrderItems = [
    {
      id: 'oi_1001_1',
      orderId: 'ord_1001',
      foodItemId: 'food_1',
      name: 'Truffle Burrata & Wild Mushroom Sourdough Pizza',
      quantity: 1,
      basePrice: 22.5,
      selectedCustomizations: [
        { groupTitle: 'Size & Crust Selection', optionName: 'Regular 10" Sourdough', price: 0 },
        { groupTitle: 'Extra Toppings & Add-Ons', optionName: 'Calabrian Chili Honey Drizzle', price: 1.5 },
      ],
      unitTotal: 24.0,
      lineTotal: 24.0,
      isVeg: true,
    },
    {
      id: 'oi_1001_2',
      orderId: 'ord_1001',
      foodItemId: 'food_3',
      name: 'Classic Espresso Mascarpone Tiramisu',
      quantity: 1,
      basePrice: 11.5,
      selectedCustomizations: [],
      unitTotal: 11.5,
      lineTotal: 11.5,
      isVeg: true,
    },
  ];

  const orders = [
    {
      id: 'ord_1001',
      orderNumber: 'FH-1001',
      customerId: 'usr_customer_1',
      customerName: 'Aarav Sharma',
      customerEmail: 'customer@foodhub.com',
      restaurantId: 'rest_1',
      restaurantName: 'Forno Di Pietra Kitchen',
      deliveryPartnerId: 'dp_1',
      deliveryPartnerName: 'Rohan Verma',
      items: sampleOrderItems,
      subtotal: 35.5,
      deliveryFee: 2.99,
      taxAmount: 2.84,
      discountAmount: 5.0,
      couponCode: 'WELCOME50',
      totalAmount: 36.33,
      status: 'out_for_delivery' as const,
      addressSnapshot: {
        label: 'Home',
        recipientName: 'Aarav Sharma',
        phone: '+1 (415) 890-2311',
        street: '742 Evergreen Terrace, Apt 4B',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94107',
      },
      contactPhone: '+1 (415) 890-2311',
      deliveryInstructions: 'Gate code #4821 — leave at front concierge desk if busy.',
      statusTimeline: [
        {
          status: 'placed' as const,
          label: 'Order Placed',
          timestamp: thirtyMinsAgo,
          note: 'Order confirmed without online payment processing',
          actorRole: 'customer' as const,
        },
        {
          status: 'accepted' as const,
          label: 'Restaurant Accepted',
          timestamp: twentyMinsAgo,
          note: 'Forno Di Pietra Kitchen accepted your order',
          actorRole: 'restaurant' as const,
        },
        {
          status: 'preparing' as const,
          label: 'Preparing Food',
          timestamp: twentyMinsAgo,
          note: 'Chef Marco is firing your sourdough pizza',
          actorRole: 'restaurant' as const,
        },
        {
          status: 'ready_for_pickup' as const,
          label: 'Ready for Pickup',
          timestamp: tenMinsAgo,
          note: 'Packed with thermal seal and ready for rider',
          actorRole: 'restaurant' as const,
        },
        {
          status: 'picked_up' as const,
          label: 'Picked Up',
          timestamp: tenMinsAgo,
          note: 'Picked up by delivery partner Rohan Verma',
          actorRole: 'delivery' as const,
        },
        {
          status: 'out_for_delivery' as const,
          label: 'Out for Delivery',
          timestamp: now,
          note: 'Rohan is en route to 742 Evergreen Terrace',
          actorRole: 'delivery' as const,
        },
      ],
      cancellationReason: null,
      createdAt: thirtyMinsAgo,
      updatedAt: now,
    },
  ];

  const deliveries = [
    {
      id: 'del_1001',
      orderId: 'ord_1001',
      orderNumber: 'FH-1001',
      partnerId: 'dp_1',
      partnerName: 'Rohan Verma',
      restaurantId: 'rest_1',
      restaurantName: 'Forno Di Pietra Kitchen',
      pickupAddress: '420 Valencia Street, Mission District, San Francisco, CA 94103',
      dropoffAddress: '742 Evergreen Terrace, Apt 4B, San Francisco, CA 94107',
      customerName: 'Aarav Sharma',
      customerPhone: '+1 (415) 890-2311',
      status: 'out_for_delivery' as const,
      deliveryFeeEarned: 5.5,
      assignedAt: twentyMinsAgo,
      pickedUpAt: tenMinsAgo,
      deliveredAt: null,
      updatedAt: now,
    },
  ];

  const reviews = [
    {
      id: 'rev_1',
      customerId: 'usr_customer_1',
      customerName: 'Aarav Sharma',
      restaurantId: 'rest_1',
      restaurantName: 'Forno Di Pietra Kitchen',
      foodItemId: 'food_1',
      orderId: 'ord_1001',
      rating: 5,
      comment:
        'The 72-hour sourdough crust has genuine wood-fired leopard charring and the truffle burrata arrived fresh and creamy.',
      createdAt: now,
    },
    {
      id: 'rev_2',
      customerId: 'usr_customer_1',
      customerName: 'Aarav Sharma',
      restaurantId: 'rest_2',
      restaurantName: 'Zaffran Royal Handi House',
      foodItemId: 'food_4',
      orderId: null,
      rating: 5,
      comment:
        'Unsealing the pastry-covered dum handi at home released incredible saffron aroma. Generous portions and fast delivery.',
      createdAt: now,
    },
    {
      id: 'rev_3',
      customerId: 'usr_customer_1',
      customerName: 'Aarav Sharma',
      restaurantId: 'rest_5',
      restaurantName: 'Dakshin Tiffin & Filter House',
      foodItemId: 'food_109',
      orderId: null,
      rating: 5,
      comment:
        'Crispy Benne Masala Dosa stayed golden and crunchy even on delivery, and the brass davara filter coffee is unmatched!',
      createdAt: now,
    },
  ];

  const sampleTicketNumber = 'YNT-2026-1042';
  const sampleAccessToken = generateTicketAccessToken(sampleTicketNumber, 'customer@foodhub.com');
  const sampleEpoch = Math.floor(Date.now() / 1000);

  const supportTicketReferences: SupportTicketReferenceRecord[] = [
    {
      id: 'tkt_1',
      ticketNumber: sampleTicketNumber,
      customerId: 'usr_customer_1',
      customerName: 'Aarav Sharma',
      customerEmail: 'customer@foodhub.com',
      customerPhone: '+1 (415) 890-2311',
      orderId: 'ord_1001',
      orderNumber: 'FH-1001',
      category: 'Delayed deliveries' as SupportTicketCategory,
      subject: 'Checking live ETA for order FH-1001',
      description:
        'Hi team, my order FH-1001 is out for delivery. Could you confirm if the chili honey drizzle side was packed?',
      priority: 'medium',
      status: 'in_progress',
      accessToken: sampleAccessToken,
      assignedAgent: 'Yantra AI Triage & Dispatch Agent',
      routingDepartment: 'Live Order & Delivery Operations',
      resolutionSummary: null,
      resolvedAt: null,
      lastEventTimestamp: sampleEpoch,
      messages: [
        {
          id: 'msg_1',
          ticketNumber: sampleTicketNumber,
          senderType: 'customer',
          senderName: 'Aarav Sharma',
          message:
            'Hi team, my order FH-1001 is out for delivery. Could you confirm if the chili honey drizzle side was packed?',
          createdAt: twentyMinsAgo,
        },
        {
          id: 'msg_2',
          ticketNumber: sampleTicketNumber,
          senderType: 'agent',
          senderName: 'Yantra Ticketing Agent',
          message:
            'Hello Aarav! I verified Order #FH-1001 with Forno Di Pietra Kitchen and rider Rohan Verma. Your Calabrian Chili Honey Drizzle was sealed inside the thermal box, and Rohan is 6 minutes away.',
          createdAt: tenMinsAgo,
        },
      ],
      createdAt: twentyMinsAgo,
      updatedAt: tenMinsAgo,
    },
  ];

  const rawSamplePayload = JSON.stringify({
    event: 'ticket.message',
    ticketNumber: sampleTicketNumber,
    timestamp: sampleEpoch,
    data: {
      ticketNumber: sampleTicketNumber,
      status: 'in_progress',
      message: {
        id: 'msg_2',
        senderType: 'agent',
        senderName: 'Yantra Ticketing Agent',
        message:
          'Hello Aarav! I verified Order #FH-1001 with Forno Di Pietra Kitchen and rider Rohan Verma.',
      },
    },
  });

  const webhookEvents = [
    {
      id: 'wh_1',
      deliveryId: 'deliv_yantra_init_001',
      eventType: 'ticket.message' as const,
      ticketNumber: sampleTicketNumber,
      signatureHeader: computeYantraWebhookSignature(
        rawSamplePayload,
        sampleEpoch,
        secrets.webhookSecret
      ),
      timestamp: sampleEpoch,
      rawPayload: rawSamplePayload,
      status: 'processed' as const,
      httpStatus: 200,
      errorMessage: null,
      processedAt: tenMinsAgo,
    },
  ];

  const notifications = [
    {
      id: 'notif_1',
      userId: 'usr_customer_1',
      targetRole: 'customer' as const,
      type: 'order_out_for_delivery' as const,
      title: 'Order #FH-1001 is Out for Delivery',
      message: 'Rohan Verma has picked up your order from Forno Di Pietra Kitchen.',
      relatedOrderId: 'ord_1001',
      relatedOrderNumber: 'FH-1001',
      relatedTicketNumber: null,
      emailDeliveryStatus: 'queued_local' as const,
      isRead: false,
      createdAt: tenMinsAgo,
    },
    {
      id: 'notif_2',
      userId: 'usr_customer_1',
      targetRole: 'customer' as const,
      type: 'ticket_reply' as const,
      title: `New Reply on Ticket ${sampleTicketNumber}`,
      message:
        'Yantra Ticketing Agent replied: Verified Order #FH-1001 with Forno Di Pietra Kitchen.',
      relatedOrderId: 'ord_1001',
      relatedOrderNumber: 'FH-1001',
      relatedTicketNumber: sampleTicketNumber,
      emailDeliveryStatus: 'queued_local' as const,
      isRead: false,
      createdAt: tenMinsAgo,
    },
  ];

  const auditLogs = [
    {
      id: 'aud_1',
      actorId: 'usr_customer_1',
      actorName: 'Aarav Sharma',
      actorRole: 'customer' as const,
      action: 'ORDER_CREATED',
      resourceType: 'Order',
      resourceId: 'FH-1001',
      details: 'Order FH-1001 placed without payment processing ($36.33 total)',
      ipAddress: '127.0.0.1',
      createdAt: thirtyMinsAgo,
    },
    {
      id: 'aud_2',
      actorId: 'yantra_webhook',
      actorName: 'Yantra Webhook Engine',
      actorRole: 'yantra_webhook' as const,
      action: 'WEBHOOK_VERIFIED',
      resourceType: 'WebhookEvent',
      resourceId: 'deliv_yantra_init_001',
      details: `HMAC-SHA256 verified event ticket.message for ${sampleTicketNumber}`,
      ipAddress: '127.0.0.1',
      createdAt: tenMinsAgo,
    },
  ];

  return {
    users,
    sessions: [],
    categories,
    restaurants,
    foodItems,
    carts: [],
    addresses,
    orders,
    orderItems: sampleOrderItems,
    deliveryPartners,
    deliveries,
    reviews,
    coupons,
    notifications,
    supportTicketReferences,
    webhookEvents,
    auditLogs,
    yantraConfig: {
      platformUrl: secrets.platformUrl,
      apiKey: secrets.apiKey,
      webhookSecret: secrets.webhookSecret,
      mode: 'hybrid_sandbox',
      welcomeMessage:
        'Welcome to FoodHub Support powered by Yantra Ticketing Agent. Select an issue or link an order for immediate assistance.',
      supportTitle: 'FoodHub × Yantra Support Agent',
      primaryColor: '#E23744',
      enabled: true,
      appDomain: 'foodhub.app',
      appDescription:
        'FoodHub is an online food ordering and delivery platform with live order tracking, restaurant menus, and customer support.',
      webhookUrl: '/api/webhooks/yantra/tickets',
      webhookEnabled: true,
      webhookConsecutiveFailures: 0,
      webhookPausedUntil: null,
    },
  };
}

export function getDb(): DatabaseSchema {
  if (global._foodhubDbCache) {
    return global._foodhubDbCache;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as DatabaseSchema;
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.restaurants)) {
        const secrets = getDefaultYantraSecrets();
        if (
          parsed.yantraConfig &&
          (parsed.yantraConfig.apiKey === 'yantra_live_sk_foodhub_2026_default_key' ||
            parsed.yantraConfig.platformUrl === 'https://yantra.foodhub.internal')
        ) {
          parsed.yantraConfig.apiKey = secrets.apiKey;
          parsed.yantraConfig.platformUrl = secrets.platformUrl;
        }
        if (parsed.yantraConfig) {
          if (typeof parsed.yantraConfig.enabled !== 'boolean') parsed.yantraConfig.enabled = true;
          if (!parsed.yantraConfig.appDomain) parsed.yantraConfig.appDomain = 'foodhub.app';
          if (!parsed.yantraConfig.appDescription) {
            parsed.yantraConfig.appDescription =
              'FoodHub is an online food ordering and delivery platform with live order tracking, restaurant menus, and customer support.';
          }
          if (!parsed.yantraConfig.webhookUrl) {
            parsed.yantraConfig.webhookUrl = '/api/webhooks/yantra/tickets';
          }
          if (typeof parsed.yantraConfig.webhookEnabled !== 'boolean') {
            parsed.yantraConfig.webhookEnabled = true;
          }
          if (typeof parsed.yantraConfig.webhookConsecutiveFailures !== 'number') {
            parsed.yantraConfig.webhookConsecutiveFailures = 0;
          }
        }

        // Auto-upgrade catalog & user workspace permissions
        const now = new Date().toISOString();
        const latestCatalog = buildSeedCatalog(now);
        let upgraded = false;

        if (Array.isArray(parsed.supportTicketReferences) && parsed.yantraConfig?.apiKey) {
          for (const tkt of parsed.supportTicketReferences) {
            if (tkt.accessToken && tkt.accessToken.startsWith('ytk_')) {
              tkt.accessToken = generateTicketAccessToken(
                tkt.ticketNumber,
                tkt.customerEmail,
                parsed.yantraConfig.apiKey
              );
              upgraded = true;
            }
          }
        }

        if (!Array.isArray(parsed.sessions)) {
          parsed.sessions = [];
          upgraded = true;
        }

        const initialAdminTotpSecret =
          process.env.INITIAL_ADMIN_TOTP_SECRET || 'JBSWY3DPEHPK3PXP';

        for (const u of parsed.users) {
          if (!Array.isArray(u.allowedWorkspaces) || u.allowedWorkspaces.length === 0) {
            u.allowedWorkspaces = u.role === 'admin' ? ['admin'] : ['customer'];
            upgraded = true;
          }
          if (u.role === 'admin') {
            if (!u.username) u.username = u.email === 'dual@foodhub.com' ? 'dual_admin' : 'admin';
            if (typeof u.mfaEnabled !== 'boolean') u.mfaEnabled = true;
            if (!u.mfaSecret) u.mfaSecret = initialAdminTotpSecret;
            if (!Array.isArray(u.recoveryCodes) || u.recoveryCodes.length === 0) {
              u.recoveryCodes = ['FH26-9901', 'FH26-9902', 'FH26-9903', 'FH26-9904'];
            }
            upgraded = true;
          } else if (!u.username) {
            u.username = u.email.split('@')[0];
          }
        }

        const existingGmailAdmin = parsed.users.find(
          (u) => u.email.toLowerCase() === 'admin@gmail.com'
        );
        if (!existingGmailAdmin) {
          parsed.users.unshift({
            id: 'usr_admin_default',
            name: 'FoodHub Admin (admin@gmail.com)',
            username: 'admin',
            email: 'admin@gmail.com',
            passwordHash: hashPassword('admin@123'),
            phone: '+1 (415) 890-9999',
            role: 'admin',
            allowedWorkspaces: ['admin'],
            mfaEnabled: false,
            mfaSecret: initialAdminTotpSecret,
            recoveryCodes: ['FH26-9901', 'FH26-9902', 'FH26-9903', 'FH26-9904'],
            favorites: [],
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });
          upgraded = true;
        } else {
          const expectedHash = hashPassword('admin@123');
          if (
            existingGmailAdmin.passwordHash !== expectedHash ||
            existingGmailAdmin.mfaEnabled !== false ||
            existingGmailAdmin.role !== 'admin'
          ) {
            existingGmailAdmin.passwordHash = expectedHash;
            existingGmailAdmin.role = 'admin';
            existingGmailAdmin.allowedWorkspaces = ['admin'];
            existingGmailAdmin.mfaEnabled = false;
            existingGmailAdmin.isActive = true;
            upgraded = true;
          }
        }

        if (!parsed.users.some((u) => u.email === 'dual@foodhub.com')) {
          parsed.users.push({
            id: 'usr_dual_1',
            name: 'Vikram Mehta (Dual Workspace)',
            username: 'dual_admin',
            email: 'dual@foodhub.com',
            passwordHash: hashPassword(process.env.INITIAL_ADMIN_PASSWORD || 'Password123!'),
            phone: '+1 (415) 890-8800',
            role: 'admin',
            allowedWorkspaces: ['customer', 'admin'],
            mfaEnabled: true,
            mfaSecret: initialAdminTotpSecret,
            recoveryCodes: ['DUAL-1001', 'DUAL-1002', 'DUAL-1003'],
            favorites: ['rest_1'],
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });
          upgraded = true;
        }

        if (!parsed.categories || parsed.categories.length < 10) {
          parsed.categories = latestCatalog.categories;
          upgraded = true;
        }
        if (parsed.restaurants.length < 6) {
          const existingIds = new Set(parsed.restaurants.map((r) => r.id));
          for (const seedRest of latestCatalog.restaurants) {
            const match = parsed.restaurants.find((r) => r.id === seedRest.id);
            if (match) {
              match.costForTwo = match.costForTwo ?? seedRest.costForTwo;
              match.isPureVeg = match.isPureVeg ?? seedRest.isPureVeg;
              match.offerBadge = match.offerBadge ?? seedRest.offerBadge;
              match.serviceableZones = match.serviceableZones ?? seedRest.serviceableZones;
              match.isRecommended = match.isRecommended ?? seedRest.isRecommended;
            } else if (!existingIds.has(seedRest.id)) {
              parsed.restaurants.push(seedRest);
            }
          }
          upgraded = true;
        }
        if (parsed.foodItems.length < 16) {
          const existingFoodIds = new Set(parsed.foodItems.map((f) => f.id));
          for (const seedFood of latestCatalog.foodItems) {
            const match = parsed.foodItems.find((f) => f.id === seedFood.id);
            if (match) {
              match.menuSection = match.menuSection ?? seedFood.menuSection;
              match.isBestseller = match.isBestseller ?? seedFood.isBestseller;
            } else if (!existingFoodIds.has(seedFood.id)) {
              parsed.foodItems.push(seedFood);
            }
          }
          upgraded = true;
        }

        global._foodhubDbCache = parsed;
        if (upgraded) {
          saveDb(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Initializing fresh FoodHub database store:', err);
  }

  const seeded = buildInitialSeedData();
  global._foodhubDbCache = seeded;
  saveDb(seeded);
  return seeded;
}

export function saveDb(db: DatabaseSchema = getDb()): void {
  global._foodhubDbCache = db;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist database file:', err);
  }
}

export function appendAuditLog(params: {
  actorId: string;
  actorName: string;
  actorRole: UserRole | 'system' | 'yantra_webhook';
  action: string;
  resourceType: string;
  resourceId: string;
  details: string;
}): void {
  const db = getDb();
  db.auditLogs.unshift({
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    details: params.details,
    ipAddress: '127.0.0.1',
    createdAt: new Date().toISOString(),
  });
  if (db.auditLogs.length > 250) {
    db.auditLogs = db.auditLogs.slice(0, 250);
  }
}
