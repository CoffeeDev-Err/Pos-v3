<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class PosApiController extends Controller
{
    public function login(Request $request)
    {
        $username = $this->normalizeUsername($request->input('username'));
        $password = (string) $request->input('password', '');

        if ($username === '') {
            return response()->json(['message' => 'Please enter your username.'], 422);
        }

        $user = DB::table('users')
            ->where('username_normalized', $username)
            ->orWhere('username', $username)
            ->first();

        if (!$user || !$user->active || !Hash::check($password, $user->password)) {
            return response()->json(['message' => 'Invalid username or password. Please check your credentials and try again.'], 401);
        }

        $token = Str::random(80);
        DB::table('users')->where('id', $user->id)->update([
            'api_token_hash' => hash('sha256', $token),
            'updated_at' => now(),
        ]);

        $user->api_token_hash = null;

        return response()->json([
            'user' => $this->userResource($user),
            'token' => $token,
        ]);
    }

    public function me(Request $request)
    {
        return response()->json(['user' => $this->userResource($this->requireUser($request))]);
    }

    public function changePassword(Request $request)
    {
        $user = $this->requireUser($request);
        $currentPassword = (string) $request->input('currentPassword', '');
        $newPassword = (string) $request->input('newPassword', '');

        if (!Hash::check($currentPassword, $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        if (strlen($newPassword) < 6) {
            return response()->json(['message' => 'Password is too weak. Please use at least 6 characters.'], 422);
        }

        DB::table('users')->where('id', $user->id)->update([
            'password' => Hash::make($newPassword),
            'updated_at' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    public function products(Request $request)
    {
        $this->requireUser($request);

        return response()->json(DB::table('products')->orderBy('name')->get()->map(fn ($row) => $this->productResource($row))->values());
    }

    public function createProduct(Request $request)
    {
        $this->requireUser($request);
        $payload = $request->all();
        $now = now();

        $id = DB::table('products')->insertGetId([
            'name' => (string) ($payload['name'] ?? ''),
            'category' => $payload['category'] ?? null,
            'price' => $this->number($payload['price'] ?? 0),
            'unit' => $payload['unit'] ?? null,
            'stock' => $this->number($payload['stock'] ?? 0),
            'low_stock_alert' => $this->number($payload['lowStockAlert'] ?? 0),
            'data' => $this->json($payload),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json($this->productResource(DB::table('products')->find($id)), 201);
    }

    public function updateProduct(Request $request, string $id)
    {
        $this->requireUser($request);
        $row = DB::table('products')->find($id);
        if (!$row) {
            return response()->json(['message' => 'Product not found.'], 404);
        }

        $payload = array_merge($this->decode($row->data), $request->all());

        DB::table('products')->where('id', $id)->update([
            'name' => (string) ($payload['name'] ?? $row->name),
            'category' => $payload['category'] ?? null,
            'price' => $this->number($payload['price'] ?? $row->price),
            'unit' => $payload['unit'] ?? null,
            'stock' => $this->number($payload['stock'] ?? $row->stock),
            'low_stock_alert' => $this->number($payload['lowStockAlert'] ?? $row->low_stock_alert),
            'data' => $this->json($payload),
            'updated_at' => now(),
        ]);

        return response()->json($this->productResource(DB::table('products')->find($id)));
    }

    public function deleteProduct(Request $request, string $id)
    {
        $this->requireUser($request);
        DB::table('products')->where('id', $id)->delete();

        return response()->noContent();
    }

    public function categories(Request $request)
    {
        $this->requireUser($request);

        return response()->json(DB::table('categories')->orderBy('name')->pluck('name')->values());
    }

    public function createCategory(Request $request)
    {
        $this->requireUser($request);
        $name = trim((string) $request->input('name'));
        if ($name === '') {
            return response()->json(['message' => 'Category name is required.'], 422);
        }

        DB::table('categories')->updateOrInsert(
            ['name' => $name],
            ['name' => $name, 'updated_at' => now(), 'created_at' => now()]
        );

        return response()->json(['name' => $name], 201);
    }

    public function deleteCategory(Request $request, string $name)
    {
        $this->requireUser($request);
        DB::table('categories')->where('name', $name)->delete();

        if ($request->boolean('deleteProducts')) {
            DB::table('products')->where('category', $name)->delete();
        }

        return response()->noContent();
    }

    public function users(Request $request)
    {
        $this->requireUser($request);

        return response()->json(DB::table('users')->orderBy('name')->get()->map(fn ($row) => $this->userResource($row))->values());
    }

    public function createUser(Request $request)
    {
        $this->requireUser($request);
        $payload = $request->all();
        $username = $this->normalizeUsername($payload['username'] ?? '');

        if ($username === '') {
            return response()->json(['message' => 'Username is required.'], 422);
        }

        if (DB::table('users')->where('username_normalized', $username)->exists()) {
            return response()->json(['message' => 'Username is already taken. Please choose another username.'], 422);
        }

        $password = (string) ($payload['password'] ?? '');
        if (strlen($password) < 6) {
            return response()->json(['message' => 'Password is too weak. Please use at least 6 characters.'], 422);
        }

        $email = $payload['email'] ?? $this->syntheticEmail($username);
        $now = now();
        $id = DB::table('users')->insertGetId([
            'name' => (string) ($payload['name'] ?? $username),
            'username' => $username,
            'username_normalized' => $username,
            'email' => $email,
            'role' => $payload['role'] ?? 'cashier',
            'active' => ($payload['active'] ?? true) !== false,
            'password' => Hash::make($password),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json($this->userResource(DB::table('users')->find($id)), 201);
    }

    public function updateUser(Request $request, string $id)
    {
        $this->requireUser($request);
        $user = DB::table('users')->find($id);
        if (!$user) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        $payload = $request->all();
        $username = array_key_exists('username', $payload)
            ? $this->normalizeUsername($payload['username'])
            : $user->username_normalized;

        if ($username === '') {
            return response()->json(['message' => 'Username is required.'], 422);
        }

        $duplicate = DB::table('users')
            ->where('username_normalized', $username)
            ->where('id', '!=', $id)
            ->exists();

        if ($duplicate) {
            return response()->json(['message' => 'Username is already taken. Please choose another username.'], 422);
        }

        $updates = [
            'name' => $payload['name'] ?? $user->name,
            'username' => $username,
            'username_normalized' => $username,
            'email' => $payload['email'] ?? $user->email,
            'role' => $payload['role'] ?? $user->role,
            'active' => array_key_exists('active', $payload) ? $payload['active'] !== false : (bool) $user->active,
            'updated_at' => now(),
        ];

        if (!empty($payload['password'])) {
            if (!Hash::check((string) ($payload['currentPassword'] ?? ''), $user->password)) {
                return response()->json(['message' => 'Current password is incorrect for this user.'], 422);
            }
            $updates['password'] = Hash::make((string) $payload['password']);
        }

        DB::table('users')->where('id', $id)->update($updates);

        return response()->json($this->userResource(DB::table('users')->find($id)));
    }

    public function updateUserStatus(Request $request, string $id)
    {
        $this->requireUser($request);
        DB::table('users')->where('id', $id)->update([
            'active' => $request->input('active') !== false,
            'updated_at' => now(),
        ]);

        return response()->json($this->userResource(DB::table('users')->find($id)));
    }

    public function deleteUser(Request $request, string $id)
    {
        $this->requireUser($request);
        DB::table('users')->where('id', $id)->delete();

        return response()->noContent();
    }

    public function transactions(Request $request)
    {
        $this->requireUser($request);

        return response()->json(DB::table('transactions')->orderByDesc('created_at')->get()->map(fn ($row) => $this->transactionResource($row))->values());
    }

    public function createTransaction(Request $request)
    {
        $actor = $this->requireUser($request);
        $payload = $request->all();
        $result = DB::transaction(function () use ($payload, $actor) {
            [$date, $time] = $this->dateTimeParts();
            $subtotal = collect($payload['items'] ?? [])->sum(fn ($item) => $this->number($item['total'] ?? 0));
            $cashierId = $payload['cashierId'] ?? $actor->id;
            $cashier = $cashierId ? DB::table('users')->find($cashierId) : null;
            $cashierName = $cashier?->name ?? $actor->name ?? 'Unknown';
            $orNumber = $this->nextOrNumber();

            $data = array_merge($payload, [
                'date' => $date,
                'time' => $time,
                'subtotal' => $subtotal,
                'cashierName' => $cashierName,
                'cashierId' => (string) $cashierId,
                'orNumber' => $orNumber,
                'cash' => $this->number($payload['cash'] ?? 0),
                'change' => $this->number($payload['change'] ?? 0),
            ]);

            $id = DB::table('transactions')->insertGetId([
                'or_number' => $orNumber,
                'date' => $date,
                'time' => $time,
                'cashier_id' => $cashierId,
                'cashier_name' => $cashierName,
                'payment_method' => $payload['paymentMethod'] ?? null,
                'subtotal' => $subtotal,
                'status' => $payload['status'] ?? null,
                'items' => $this->json($payload['items'] ?? []),
                'customer' => $this->json($payload['customer'] ?? []),
                'data' => $this->json($data),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $updatedProducts = [];
            foreach (($payload['items'] ?? []) as $item) {
                $product = DB::table('products')->find((string) ($item['productId'] ?? ''));
                if (!$product) {
                    continue;
                }

                $productData = $this->decode($product->data);
                $conversionRate = $this->number($item['conversionRate'] ?? 1);
                $newStock = max(0, $this->number($productData['stock'] ?? $product->stock) - ($this->number($item['qty'] ?? 0) * $conversionRate));
                $productData['stock'] = $newStock;
                DB::table('products')->where('id', $product->id)->update([
                    'stock' => $newStock,
                    'data' => $this->json($productData),
                    'updated_at' => now(),
                ]);
                $updatedProducts[] = $this->productResource(DB::table('products')->find($product->id));
            }

            $credit = null;
            if (($payload['paymentMethod'] ?? null) === 'credit') {
                $customer = $payload['customer'] ?? [];
                $credit = $this->storeCredit([
                    'transactionId' => (string) $id,
                    'orNumber' => $orNumber,
                    'customerName' => $customer['name'] ?? '',
                    'customerContact' => $customer['contact'] ?? '',
                    'customerAddress' => $customer['address'] ?? '',
                    'items' => $payload['items'] ?? [],
                    'totalAmount' => $subtotal,
                    'dueDate' => $payload['dueDate'] ?? '',
                    'cashierId' => (string) $cashierId,
                    'cashierName' => $cashierName,
                ]);
            }

            return [
                'transaction' => $this->transactionResource(DB::table('transactions')->find($id)),
                'updatedProducts' => $updatedProducts,
                'credit' => $credit,
            ];
        });

        return response()->json($result, 201);
    }

    public function stockMovements(Request $request)
    {
        $this->requireUser($request);

        return response()->json(DB::table('stock_movements')->orderByDesc('created_at')->get()->map(fn ($row) => $this->movementResource($row))->values());
    }

    public function createStockMovement(Request $request)
    {
        $this->requireUser($request);
        $payload = $request->all();
        $result = DB::transaction(function () use ($payload) {
            $id = DB::table('stock_movements')->insertGetId([
                'product_id' => $payload['productId'] ?? null,
                'product_name' => $payload['productName'] ?? null,
                'type' => $payload['type'] ?? null,
                'qty' => $this->number($payload['qty'] ?? 0),
                'data' => $this->json($payload),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $updatedProduct = null;
            $product = DB::table('products')->find((string) ($payload['productId'] ?? ''));
            if ($product) {
                $productData = $this->decode($product->data);
                $newStock = $this->number($productData['stock'] ?? $product->stock) + $this->number($payload['qty'] ?? 0);
                $productData['stock'] = $newStock;
                DB::table('products')->where('id', $product->id)->update([
                    'stock' => $newStock,
                    'data' => $this->json($productData),
                    'updated_at' => now(),
                ]);
                $updatedProduct = $this->productResource(DB::table('products')->find($product->id));
            }

            return [
                'movement' => $this->movementResource(DB::table('stock_movements')->find($id)),
                'product' => $updatedProduct,
                'updatedProduct' => $updatedProduct,
            ];
        });

        return response()->json($result, 201);
    }

    public function settings(Request $request)
    {
        $this->requireUser($request);
        $row = DB::table('settings')->where('key', 'global')->first();

        return response()->json($row ? $this->decode($row->value) : []);
    }

    public function updateSettings(Request $request)
    {
        $this->requireUser($request);
        $payload = array_filter($request->all(), fn ($value) => $value !== null);
        $now = now();

        $current = DB::table('settings')->where('key', 'global')->first();
        $settings = array_merge($current ? $this->decode($current->value) : [], $payload);

        DB::table('settings')->updateOrInsert(
            ['key' => 'global'],
            ['value' => $this->json($settings), 'created_at' => $current->created_at ?? $now, 'updated_at' => $now]
        );

        return response()->json($settings);
    }

    public function expenses(Request $request)
    {
        $this->requireUser($request);
        $query = DB::table('expenses')->orderByDesc('created_at');
        if ($request->query('from') && $request->query('to')) {
            $query->whereBetween('date', [$request->query('from'), $request->query('to')]);
        }

        return response()->json($query->get()->map(fn ($row) => $this->expenseResource($row))->values());
    }

    public function createExpense(Request $request)
    {
        $this->requireUser($request);
        $payload = $request->all();
        $id = DB::table('expenses')->insertGetId([
            'date' => $payload['date'] ?? now()->format('Y-m-d'),
            'name' => $payload['name'] ?? null,
            'category' => $payload['category'] ?? null,
            'amount' => $this->number($payload['amount'] ?? 0),
            'data' => $this->json($payload),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json($this->expenseResource(DB::table('expenses')->find($id)), 201);
    }

    public function auditLogs(Request $request)
    {
        $this->requireUser($request);

        return response()->json(DB::table('audit_logs')->orderByDesc('created_at')->get()->map(fn ($row) => [
            'id' => (string) $row->id,
            'user' => $row->user,
            'action' => $row->action,
            'timestamp' => $row->timestamp,
            'createdAt' => $this->dateOnly($row->created_at),
        ])->values());
    }

    public function addAuditLog(Request $request)
    {
        $this->requireUser($request);
        $now = now();
        $id = DB::table('audit_logs')->insertGetId([
            'user' => $request->input('user'),
            'action' => (string) $request->input('action', ''),
            'timestamp' => $now->format('Y-m-d H:i'),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json(DB::table('audit_logs')->find($id), 201);
    }

    public function orders(Request $request)
    {
        $this->requireUser($request);

        return response()->json(DB::table('orders')->orderByDesc('created_at')->get()->map(fn ($row) => $this->orderResource($row))->values());
    }

    public function createOrder(Request $request)
    {
        $actor = $this->requireUser($request);
        $payload = $request->all();
        [$date, $time] = $this->dateTimeParts();
        $cashierId = $payload['cashierId'] ?? $actor->id;
        $cashier = $cashierId ? DB::table('users')->find($cashierId) : null;
        $cashierName = $cashier?->name ?? $actor->name ?? 'Unknown';
        $subtotal = collect($payload['items'] ?? [])->sum(fn ($item) => $this->number($item['total'] ?? 0));

        $data = array_merge([
            'status' => 'pending',
        ], $payload, [
            'date' => $date,
            'time' => $time,
            'subtotal' => $subtotal,
            'cashierName' => $cashierName,
            'updatedById' => (string) $cashierId,
            'updatedByName' => $cashierName,
            'updatedAtText' => "{$date} {$time}:00",
            'editLock' => null,
        ]);

        $id = DB::table('orders')->insertGetId([
            'status' => $data['status'],
            'date' => $date,
            'time' => $time,
            'cashier_id' => $cashierId,
            'cashier_name' => $cashierName,
            'subtotal' => $subtotal,
            'items' => $this->json($payload['items'] ?? []),
            'customer' => $this->json($payload['customer'] ?? []),
            'edit_lock' => null,
            'data' => $this->json($data),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json($this->orderResource(DB::table('orders')->find($id)), 201);
    }

    public function updateOrder(Request $request, string $id)
    {
        $this->requireUser($request);
        $row = DB::table('orders')->find($id);
        if (!$row) {
            return response()->json(['message' => 'The specified order could not be found.'], 404);
        }

        $before = $this->orderResource($row);
        $payload = $request->all();
        $actor = $payload['__actor'] ?? null;
        unset($payload['__actor']);

        $updatedById = $actor['id'] ?? $before['updatedById'] ?? '';
        $updatedByName = $actor['name'] ?? $before['updatedByName'] ?? 'System';
        $updatedAtText = $this->localDateTimeText();
        $data = array_merge($this->decode($row->data), $payload, [
            'updatedById' => (string) $updatedById,
            'updatedByName' => $updatedByName,
            'updatedAtText' => $updatedAtText,
        ]);

        DB::table('orders')->where('id', $id)->update([
            'status' => $data['status'] ?? $row->status,
            'subtotal' => $this->number($data['subtotal'] ?? $row->subtotal),
            'items' => $this->json($data['items'] ?? $this->decode($row->items)),
            'customer' => $this->json($data['customer'] ?? $this->decode($row->customer)),
            'edit_lock' => $this->json($data['editLock'] ?? null),
            'data' => $this->json($data),
            'updated_at' => now(),
        ]);

        if (array_key_exists('items', $payload) || array_key_exists('subtotal', $payload)) {
            DB::table('order_edit_logs')->insert([
                'order_id' => $id,
                'edited_at_text' => $updatedAtText,
                'edited_by_id' => $updatedById ?: null,
                'edited_by_name' => $updatedByName,
                'changed_fields' => $this->json(array_keys($payload)),
                'before' => $this->json([
                    'status' => $before['status'] ?? '',
                    'subtotal' => $this->number($before['subtotal'] ?? 0),
                    'items' => $this->sanitizeOrderItemsForAudit($before['items'] ?? []),
                ]),
                'after' => $this->json([
                    'status' => $data['status'] ?? '',
                    'subtotal' => $this->number($data['subtotal'] ?? 0),
                    'items' => $this->sanitizeOrderItemsForAudit($data['items'] ?? []),
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json($this->orderResource(DB::table('orders')->find($id)));
    }

    public function acquireOrderEditLock(Request $request, string $id)
    {
        $this->requireUser($request);
        $actor = $request->input('actor', []);
        $ttlMinutes = max(1, (int) $request->input('ttlMinutes', 5));
        $row = DB::table('orders')->find($id);
        if (!$row) {
            return response()->json(['message' => 'The specified order could not be found.'], 404);
        }

        $data = $this->decode($row->data);
        $lock = $data['editLock'] ?? null;
        $nowMs = (int) floor(microtime(true) * 1000);
        $lockedByOther = $lock
            && (int) ($lock['expiresAtMs'] ?? 0) > $nowMs
            && !empty($lock['byId'])
            && (string) $lock['byId'] !== (string) ($actor['id'] ?? '');

        if ($lockedByOther) {
            return response()->json(['message' => 'This order is currently being edited by '.($lock['byName'] ?? 'another user').'. Please try again shortly.'], 409);
        }

        $data['editLock'] = [
            'byId' => (string) ($actor['id'] ?? ''),
            'byName' => $actor['name'] ?? 'Unknown',
            'acquiredAtMs' => $nowMs,
            'expiresAtMs' => $nowMs + ($ttlMinutes * 60 * 1000),
        ];

        DB::table('orders')->where('id', $id)->update([
            'edit_lock' => $this->json($data['editLock']),
            'data' => $this->json($data),
            'updated_at' => now(),
        ]);

        return response()->json($this->orderResource(DB::table('orders')->find($id)));
    }

    public function releaseOrderEditLock(Request $request, string $id)
    {
        $this->requireUser($request);
        $actor = $request->input('actor', []);
        $row = DB::table('orders')->find($id);
        if (!$row) {
            return response()->json(null);
        }

        $data = $this->decode($row->data);
        $lock = $data['editLock'] ?? null;
        if ($lock && (empty($actor['id']) || empty($lock['byId']) || (string) $lock['byId'] === (string) $actor['id'])) {
            $data['editLock'] = null;
            DB::table('orders')->where('id', $id)->update([
                'edit_lock' => null,
                'data' => $this->json($data),
                'updated_at' => now(),
            ]);
        }

        return response()->json($this->orderResource(DB::table('orders')->find($id)));
    }

    public function credits(Request $request)
    {
        $this->requireUser($request);

        return response()->json(DB::table('credits')->orderByDesc('created_at')->get()->map(fn ($row) => $this->creditResource($row))->values());
    }

    public function createCredit(Request $request)
    {
        $this->requireUser($request);

        return response()->json($this->storeCredit($request->all()), 201);
    }

    public function addCreditPayment(Request $request, string $id)
    {
        $this->requireUser($request);
        $row = DB::table('credits')->find($id);
        if (!$row) {
            return response()->json(['message' => 'The specified credit record could not be found.'], 404);
        }

        $data = $this->decode($row->data);
        $payments = $this->decode($row->payments);
        $amount = $this->number($request->input('amount', 0));
        $newAmountPaid = $this->number($row->amount_paid) + $amount;
        $newRemaining = max(0, $this->number($row->total_amount) - $newAmountPaid);
        $newStatus = $newRemaining <= 0 ? 'paid' : 'partial';
        $payments[] = ['amount' => $amount, 'date' => now()->format('Y-m-d'), 'note' => $request->input('note', '')];

        $data = array_merge($data, [
            'amountPaid' => $newAmountPaid,
            'remainingBalance' => $newRemaining,
            'status' => $newStatus,
            'payments' => $payments,
        ]);

        DB::table('credits')->where('id', $id)->update([
            'amount_paid' => $newAmountPaid,
            'remaining_balance' => $newRemaining,
            'status' => $newStatus,
            'payments' => $this->json($payments),
            'data' => $this->json($data),
            'paid_at' => $newStatus === 'paid' ? now() : null,
            'updated_at' => now(),
        ]);

        return response()->json($this->creditResource(DB::table('credits')->find($id)));
    }

    public function updateCreditDueDate(Request $request, string $id)
    {
        $this->requireUser($request);
        $row = DB::table('credits')->find($id);
        if (!$row) {
            return response()->json(['message' => 'The specified credit record could not be found.'], 404);
        }

        $data = array_merge($this->decode($row->data), ['dueDate' => $request->input('dueDate')]);
        DB::table('credits')->where('id', $id)->update([
            'due_date' => $request->input('dueDate'),
            'data' => $this->json($data),
            'updated_at' => now(),
        ]);

        return response()->json($this->creditResource(DB::table('credits')->find($id)));
    }

    public function voidTransaction(Request $request, string $id)
    {
        $this->requireUser($request);
        $result = DB::transaction(function () use ($request, $id) {
            $row = DB::table('transactions')->find($id);
            if (!$row) {
                return ['error' => ['message' => 'The specified transaction could not be found.', 'status' => 404]];
            }

            $data = $this->decode($row->data);
            if (($data['status'] ?? $row->status) === 'void') {
                return ['error' => ['message' => 'This transaction has already been voided and cannot be modified.', 'status' => 422]];
            }

            $voidedAt = $this->localDateTimeText(false);
            $data['status'] = 'void';
            $data['voidReason'] = $request->input('voidReason', $request->input('reason', ''));
            $data['voidedAt'] = $voidedAt;

            DB::table('transactions')->where('id', $id)->update([
                'status' => 'void',
                'data' => $this->json($data),
                'updated_at' => now(),
            ]);

            $updatedProducts = [];
            foreach (($data['items'] ?? []) as $item) {
                $product = DB::table('products')->find((string) ($item['productId'] ?? ''));
                if (!$product) {
                    continue;
                }

                $productData = $this->decode($product->data);
                $baseQty = $this->number($item['qty'] ?? 0) * $this->number($item['conversionRate'] ?? 1);
                $newStock = $this->number($productData['stock'] ?? $product->stock) + $baseQty;
                $productData['stock'] = $newStock;
                DB::table('products')->where('id', $product->id)->update([
                    'stock' => $newStock,
                    'data' => $this->json($productData),
                    'updated_at' => now(),
                ]);
                $updatedProducts[] = ['id' => (string) $product->id, 'stock' => $newStock];
            }

            return [
                'transaction' => $this->transactionResource(DB::table('transactions')->find($id)),
                'updatedProducts' => $updatedProducts,
            ];
        });

        if (isset($result['error'])) {
            return response()->json(['message' => $result['error']['message']], $result['error']['status']);
        }

        return response()->json($result);
    }

    public function migrateOrNumbers(Request $request)
    {
        $this->requireUser($request);
        $count = 0;
        DB::transaction(function () use (&$count) {
            $transactions = DB::table('transactions')->orderBy('created_at')->get();
            foreach ($transactions as $transaction) {
                $count++;
                $orNumber = str_pad((string) $count, 10, '0', STR_PAD_LEFT);
                $data = array_merge($this->decode($transaction->data), ['orNumber' => $orNumber]);
                DB::table('transactions')->where('id', $transaction->id)->update([
                    'or_number' => $orNumber,
                    'data' => $this->json($data),
                    'updated_at' => now(),
                ]);

                DB::table('credits')->where('transaction_id', $transaction->id)->get()->each(function ($credit) use ($orNumber) {
                    $creditData = array_merge($this->decode($credit->data), ['orNumber' => $orNumber]);
                    DB::table('credits')->where('id', $credit->id)->update([
                        'or_number' => $orNumber,
                        'data' => $this->json($creditData),
                        'updated_at' => now(),
                    ]);
                });
            }

            DB::table('counters')->updateOrInsert(
                ['name' => 'orNumber'],
                ['count' => $count, 'created_at' => now(), 'updated_at' => now()]
            );
        });

        return response()->json($count);
    }

    private function storeCredit(array $payload): array
    {
        $date = now()->format('Y-m-d');
        $data = array_merge($payload, [
            'amountPaid' => 0,
            'remainingBalance' => $this->number($payload['totalAmount'] ?? 0),
            'status' => 'unpaid',
            'payments' => [],
            'startDate' => $payload['startDate'] ?? $date,
        ]);

        $id = DB::table('credits')->insertGetId([
            'transaction_id' => $payload['transactionId'] ?? null,
            'or_number' => $payload['orNumber'] ?? null,
            'customer_name' => $payload['customerName'] ?? null,
            'total_amount' => $this->number($payload['totalAmount'] ?? 0),
            'amount_paid' => 0,
            'remaining_balance' => $this->number($payload['totalAmount'] ?? 0),
            'status' => 'unpaid',
            'start_date' => $data['startDate'],
            'due_date' => $payload['dueDate'] ?? null,
            'payments' => $this->json([]),
            'items' => $this->json($payload['items'] ?? []),
            'data' => $this->json($data),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $this->creditResource(DB::table('credits')->find($id));
    }

    private function nextOrNumber(): string
    {
        $counter = DB::table('counters')->where('name', 'orNumber')->lockForUpdate()->first();
        $count = ((int) ($counter->count ?? 0)) + 1;

        DB::table('counters')->updateOrInsert(
            ['name' => 'orNumber'],
            ['count' => $count, 'created_at' => $counter->created_at ?? now(), 'updated_at' => now()]
        );

        return str_pad((string) $count, 10, '0', STR_PAD_LEFT);
    }

    private function requireUser(Request $request): object
    {
        $token = $request->bearerToken() ?: $request->header('X-Auth-Token');
        if (!$token) {
            abort(401, 'Not authenticated');
        }

        $user = DB::table('users')->where('api_token_hash', hash('sha256', $token))->first();
        if (!$user || !$user->active) {
            abort(401, 'Not authenticated');
        }

        return $user;
    }

    private function userResource(?object $row): ?array
    {
        if (!$row) {
            return null;
        }

        return [
            'id' => (string) $row->id,
            'name' => $row->name,
            'username' => $row->username,
            'usernameNormalized' => $row->username_normalized,
            'email' => $row->email,
            'role' => $row->role,
            'active' => (bool) $row->active,
            'createdAt' => $this->dateOnly($row->created_at ?? null),
        ];
    }

    private function productResource(?object $row): ?array
    {
        if (!$row) {
            return null;
        }

        return array_merge($this->decode($row->data), [
            'id' => (string) $row->id,
            'name' => $row->name,
            'category' => $row->category,
            'price' => $this->number($row->price),
            'unit' => $row->unit,
            'stock' => $this->number($row->stock),
            'lowStockAlert' => $this->number($row->low_stock_alert),
            'createdAt' => $this->dateOnly($row->created_at),
        ]);
    }

    private function transactionResource(?object $row): ?array
    {
        if (!$row) {
            return null;
        }

        return array_merge($this->decode($row->data), [
            'id' => (string) $row->id,
            'orNumber' => $row->or_number,
            'date' => $row->date,
            'time' => $row->time,
            'cashierId' => $row->cashier_id ? (string) $row->cashier_id : '',
            'cashierName' => $row->cashier_name,
            'paymentMethod' => $row->payment_method,
            'subtotal' => $this->number($row->subtotal),
            'status' => $row->status,
            'items' => $this->decode($row->items),
            'customer' => $this->decode($row->customer),
            'createdAt' => $this->dateOnly($row->created_at),
        ]);
    }

    private function movementResource(?object $row): ?array
    {
        if (!$row) {
            return null;
        }

        return array_merge($this->decode($row->data), [
            'id' => (string) $row->id,
            'productId' => $row->product_id ? (string) $row->product_id : null,
            'productName' => $row->product_name,
            'type' => $row->type,
            'qty' => $this->number($row->qty),
            'createdAt' => $this->dateOnly($row->created_at),
        ]);
    }

    private function expenseResource(?object $row): ?array
    {
        if (!$row) {
            return null;
        }

        return array_merge($this->decode($row->data), [
            'id' => (string) $row->id,
            'date' => $row->date,
            'name' => $row->name,
            'category' => $row->category,
            'amount' => $this->number($row->amount),
            'createdAt' => $this->dateOnly($row->created_at),
        ]);
    }

    private function orderResource(?object $row): ?array
    {
        if (!$row) {
            return null;
        }

        return array_merge($this->decode($row->data), [
            'id' => (string) $row->id,
            'status' => $row->status,
            'date' => $row->date,
            'time' => $row->time,
            'cashierId' => $row->cashier_id ? (string) $row->cashier_id : '',
            'cashierName' => $row->cashier_name,
            'subtotal' => $this->number($row->subtotal),
            'items' => $this->decode($row->items),
            'customer' => $this->decode($row->customer),
            'editLock' => $this->decode($row->edit_lock),
            'createdAt' => $this->dateOnly($row->created_at),
        ]);
    }

    private function creditResource(?object $row): ?array
    {
        if (!$row) {
            return null;
        }

        return array_merge($this->decode($row->data), [
            'id' => (string) $row->id,
            'transactionId' => $row->transaction_id ? (string) $row->transaction_id : null,
            'orNumber' => $row->or_number,
            'customerName' => $row->customer_name,
            'totalAmount' => $this->number($row->total_amount),
            'amountPaid' => $this->number($row->amount_paid),
            'remainingBalance' => $this->number($row->remaining_balance),
            'status' => $row->status,
            'startDate' => $row->start_date,
            'dueDate' => $row->due_date,
            'payments' => $this->decode($row->payments),
            'items' => $this->decode($row->items),
            'createdAt' => $this->dateOnly($row->created_at),
            'updatedAt' => $this->dateOnly($row->updated_at),
        ]);
    }

    private function sanitizeOrderItemsForAudit(array $items): array
    {
        return array_map(fn ($item) => [
            'productId' => $item['productId'] ?? '',
            'name' => $item['name'] ?? '',
            'variantId' => $item['variantId'] ?? null,
            'variantName' => $item['variantName'] ?? null,
            'qty' => $this->number($item['qty'] ?? 0),
            'unit' => $item['unit'] ?? '',
            'price' => $this->number($item['price'] ?? 0),
            'total' => $this->number($item['total'] ?? 0),
        ], $items);
    }

    private function normalizeUsername(mixed $value): string
    {
        return strtolower(trim((string) $value));
    }

    private function syntheticEmail(string $username): string
    {
        $safe = preg_replace('/[^a-z0-9._-]/', '.', $username) ?: 'user';

        return "{$safe}@carrensstore.app";
    }

    private function decode(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (!$value) {
            return [];
        }

        $decoded = json_decode((string) $value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function json(mixed $value): string
    {
        return json_encode($value, JSON_UNESCAPED_SLASHES);
    }

    private function number(mixed $value): float
    {
        return (float) ($value ?? 0);
    }

    private function dateOnly(mixed $value): ?string
    {
        if (!$value) {
            return null;
        }

        return Carbon::parse($value)->format('Y-m-d');
    }

    private function dateTimeParts(): array
    {
        $now = now();

        return [$now->format('Y-m-d'), $now->format('H:i')];
    }

    private function localDateTimeText(bool $withSeconds = true): string
    {
        return now()->format($withSeconds ? 'Y-m-d H:i:s' : 'Y-m-d H:i');
    }
}
