<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $now = now();
        $this->seedInitialAdmin($now);
        $this->seedSettings($now);
        $this->seedCounter($now);

        if (filter_var(env('POS_SEED_DEMO_DATA', false), FILTER_VALIDATE_BOOLEAN)) {
            $this->seedDemoCatalog($now);
        }
    }

    private function seedInitialAdmin($now): void
    {
        $username = $this->normalizeUsername(env('POS_ADMIN_USERNAME', 'owner'));
        $password = (string) env('POS_ADMIN_PASSWORD', '');

        if ($password === '') {
            throw new RuntimeException('Set POS_ADMIN_PASSWORD in backend/.env before running the database seeder.');
        }

        DB::table('users')->updateOrInsert(
            ['username_normalized' => $username],
            [
                'name' => env('POS_ADMIN_NAME', 'Store Owner'),
                'username' => $username,
                'username_normalized' => $username,
                'email' => env('POS_ADMIN_EMAIL', 'owner@example.local'),
                'role' => 'superadmin',
                'active' => true,
                'password' => Hash::make($password),
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
    }

    private function seedSettings($now): void
    {
        DB::table('settings')->updateOrInsert(
            ['key' => 'global'],
            [
                'value' => json_encode([
                    'storeName' => env('POS_STORE_NAME', 'POS Store'),
                    'address' => env('POS_STORE_ADDRESS', ''),
                    'phone' => env('POS_STORE_PHONE', ''),
                    'receiptFooter' => env('POS_RECEIPT_FOOTER', 'Thank you for your purchase.'),
                ], JSON_UNESCAPED_SLASHES),
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
    }

    private function seedCounter($now): void
    {
        DB::table('counters')->updateOrInsert(
            ['name' => 'orNumber'],
            ['count' => 0, 'created_at' => $now, 'updated_at' => $now]
        );
    }

    private function seedDemoCatalog($now): void
    {
        foreach (['Eggs', 'Mantika', 'Daily Needs'] as $name) {
            DB::table('categories')->updateOrInsert(
                ['name' => $name],
                ['name' => $name, 'created_at' => $now, 'updated_at' => $now]
            );
        }

        $products = [
            ['name' => 'Itlog (per piraso)', 'category' => 'Eggs', 'price' => 8, 'unit' => 'pc', 'stock' => 360, 'lowStockAlert' => 50],
            ['name' => 'Itlog (per tray/30)', 'category' => 'Eggs', 'price' => 210, 'unit' => 'tray', 'stock' => 20, 'lowStockAlert' => 5],
            ['name' => 'Mantika 250ml', 'category' => 'Mantika', 'price' => 35, 'unit' => 'btl', 'stock' => 48, 'lowStockAlert' => 10],
            ['name' => 'Mantika 500ml', 'category' => 'Mantika', 'price' => 65, 'unit' => 'btl', 'stock' => 24, 'lowStockAlert' => 8],
            ['name' => 'Mantika 1L', 'category' => 'Mantika', 'price' => 120, 'unit' => 'btl', 'stock' => 4, 'lowStockAlert' => 5],
            ['name' => 'Asin', 'category' => 'Daily Needs', 'price' => 15, 'unit' => 'pack', 'stock' => 30, 'lowStockAlert' => 10],
            ['name' => 'Toyo (Marca Pina)', 'category' => 'Daily Needs', 'price' => 20, 'unit' => 'btl', 'stock' => 25, 'lowStockAlert' => 10],
            ['name' => 'Suka', 'category' => 'Daily Needs', 'price' => 18, 'unit' => 'btl', 'stock' => 6, 'lowStockAlert' => 8],
            ['name' => 'Lucky Me Noodles', 'category' => 'Daily Needs', 'price' => 12, 'unit' => 'pack', 'stock' => 100, 'lowStockAlert' => 20],
            ['name' => '3-in-1 Kape', 'category' => 'Daily Needs', 'price' => 8, 'unit' => 'sachet', 'stock' => 200, 'lowStockAlert' => 30],
            ['name' => 'Bigas (1kg)', 'category' => 'Daily Needs', 'price' => 52, 'unit' => 'kg', 'stock' => 50, 'lowStockAlert' => 10],
            ['name' => 'Sukang Maasim', 'category' => 'Daily Needs', 'price' => 22, 'unit' => 'btl', 'stock' => 15, 'lowStockAlert' => 5],
        ];

        foreach ($products as $product) {
            DB::table('products')->updateOrInsert(
                ['name' => $product['name']],
                [
                    'name' => $product['name'],
                    'category' => $product['category'],
                    'price' => $product['price'],
                    'unit' => $product['unit'],
                    'stock' => $product['stock'],
                    'low_stock_alert' => $product['lowStockAlert'],
                    'data' => json_encode($product, JSON_UNESCAPED_SLASHES),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }
    }

    private function normalizeUsername(mixed $value): string
    {
        return strtolower(trim((string) $value));
    }
}
