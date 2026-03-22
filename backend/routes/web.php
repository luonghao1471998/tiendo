<?php

use Illuminate\Support\Facades\Route;

/*
| Nếu người dùng mở link cũ /share/{token} trên cổng backend (APP_URL) trong khi SPA chạy
| chỗ khác (FRONTEND_URL), chuyển hướng sang đúng giao diện React.
*/
$frontend = rtrim((string) config('app.frontend_url'), '/');
$appUrl = rtrim((string) config('app.url'), '/');

if ($frontend !== '' && $frontend !== $appUrl) {
    Route::get('/share/{token}', function (string $token) use ($frontend) {
        return redirect()->away($frontend.'/share/'.$token);
    })->where('token', '[A-Za-z0-9_-]+');
}

Route::get('/', function () {
    return view('welcome');
});
