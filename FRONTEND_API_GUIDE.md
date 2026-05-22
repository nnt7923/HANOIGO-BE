# HanoiGo Frontend API Guide

Tài liệu này tóm tắt backend hiện tại để frontend có thể tích hợp nhanh mà không phải đọc toàn bộ NestJS source.

## Tổng Quan

- Backend: NestJS, TypeScript, MongoDB/Mongoose.
- Base API local: `http://localhost:5000/api`
- Swagger local: `http://localhost:5000/docs`
- Auth: JWT access token + refresh token.
- Upload ảnh: Cloudinary qua backend.
- Validation: request body/query có `whitelist`, field ngoài DTO sẽ bị reject.
- CORS local mặc định: `http://localhost:5173`

Header cho route cần đăng nhập:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Upload ảnh dùng:

```http
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

## Response Và Error Chung

Phần lớn endpoint trả trực tiếp document MongoDB/Mongoose, thường có:

```ts
{
  _id: string;
  createdAt: string;
  updatedAt: string;
}
```

Một số user response dùng thêm `id`.

Lỗi NestJS thường có dạng:

```json
{
  "message": "Error message or validation errors",
  "error": "Bad Request",
  "statusCode": 400
}
```

Frontend nên xử lý các status chính:

- `400`: sai validation, OTP sai/hết hạn.
- `401`: chưa login, token sai/hết hạn, refresh token sai.
- `403`: không đủ quyền, email chưa verify, vượt quota/subscription.
- `404`: không tìm thấy tài nguyên.
- `409`: conflict, ví dụ email đã tồn tại, đã review/report/follow.
- `429`: resend OTP quá nhanh.

## Enum Dùng Chung

```ts
type UserRole = 'user' | 'owner' | 'admin';
type OtpPurpose = 'email_verification' | 'password_reset';

type PlaceCategory =
  | 'food'
  | 'cafe'
  | 'stay'
  | 'attraction'
  | 'workspace'
  | 'transport'
  | 'other';

type PlaceStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'rejected'
  | 'suspended';

type SubscriptionPlan = 'free' | 'pro';
type SubscriptionStatus = 'active' | 'canceled' | 'expired';

type ItineraryVisibility = 'private' | 'public' | 'unlisted';
type ItinerarySource = 'gemini' | 'cache' | 'fallback';

type ReviewStatus = 'published' | 'hidden';

type PostType = 'check_in' | 'experience' | 'tip';
type PostStatus = 'published' | 'hidden' | 'deleted';

type NotificationType = 'system' | 'review' | 'itinerary' | 'subscription';
```

Pagination query dùng ở nhiều endpoint:

```ts
{
  page?: number;  // default 1, min 1
  limit?: number; // default 20, min 1, max 100
}
```

## Auth Flow

### Đăng Ký Email

`POST /api/auth/register`

```json
{
  "name": "Nguyen Van A",
  "email": "user@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "message": "Registration created. Please verify the OTP sent to email.",
  "email": "user@example.com"
}
```

Sau register, user chưa login được cho tới khi verify OTP.

### Verify OTP Đăng Ký

`POST /api/auth/verify-otp`

```json
{
  "email": "user@example.com",
  "code": "123456",
  "purpose": "email_verification"
}
```

Response:

```ts
{
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
}
```

### Resend OTP

`POST /api/auth/resend-otp`

```json
{
  "email": "user@example.com",
  "purpose": "email_verification"
}
```

Hoặc cho quên mật khẩu:

```json
{
  "email": "user@example.com",
  "purpose": "password_reset"
}
```

Backend giới hạn resend theo `OTP_RESEND_COOLDOWN_SECONDS`, mặc định 60 giây.

### Login Email/Password

`POST /api/auth/login`

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response giống `verify-otp`.

### Login Google

`POST /api/auth/login/google`

Frontend lấy Google ID token từ Google OAuth client rồi gửi:

```json
{
  "idToken": "<google-id-token>"
}
```

Backend verify token theo `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_IDS`.

### Refresh Token

`POST /api/auth/refresh`

```json
{
  "refreshToken": "<refresh-token>"
}
```

Response trả access token và refresh token mới. Frontend nên thay cả hai token cũ.

### Logout

`POST /api/auth/logout`

Yêu cầu access token. Revoke session hiện tại.

### Logout Tất Cả Thiết Bị

`POST /api/auth/logout-all`

Yêu cầu access token. Invalidate tất cả token cũ của user.

### Revoke Refresh Token

`POST /api/auth/revoke-token`

```json
{
  "refreshToken": "<refresh-token>"
}
```

Dùng khi client muốn cleanup refresh token nhưng access token đã mất/hết hạn.

### Change Password

`POST /api/auth/change-password`

```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

Sau khi đổi password, backend invalidate token cũ. Frontend nên logout user và yêu cầu login lại.

### Forgot / Reset Password

`POST /api/auth/forgot-password`

```json
{
  "email": "user@example.com"
}
```

`POST /api/auth/reset-password`

```json
{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "newpassword123"
}
```

## User Và Role

### User Object An Toàn

```ts
type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  authProvider: 'local' | 'google';
  emailVerifiedAt?: string;
  avatarUrl?: string;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt?: string;
  monthlyItineraryLimit: number;
  placeLimit: number;
  itineraryUsageCount: number;
  usageResetAt: string;
};
```

### Endpoints

| Method | Path | Auth | Role | Mục đích |
|---|---|---|---|---|
| GET | `/api/users/me` | Có | any | Lấy profile hiện tại |
| PATCH | `/api/users/me` | Có | any | Cập nhật `name`, `avatarUrl` |
| GET | `/api/users/me/quota` | Có | any | Lấy quota itinerary/place |
| POST | `/api/users/me/owner-request` | Có | user | Gửi yêu cầu trở thành owner |
| GET | `/api/users` | Có | admin | Danh sách user |
| PATCH | `/api/users/:id/role` | Có | admin | Đổi role |
| PATCH | `/api/users/:id/subscription` | Có | admin | Đổi subscription |
| GET | `/api/users/owner-requests` | Có | admin | Danh sách yêu cầu owner |
| POST | `/api/users/owner-requests/:id/approve` | Có | admin | Duyệt owner |
| POST | `/api/users/owner-requests/:id/reject` | Có | admin | Từ chối owner |

Payload owner request:

```json
{
  "businessName": "HanoiGo Cafe",
  "businessAddress": "Hoa Lac, Hanoi",
  "contactPhone": "0987654321",
  "reason": "I want to manage my place on HanoiGo."
}
```

Payload update subscription:

```json
{
  "subscriptionPlan": "pro",
  "monthlyItineraryLimit": 100,
  "placeLimit": 50,
  "subscriptionStatus": "active",
  "subscriptionExpiresAt": "2026-12-31T00:00:00.000Z"
}
```

## Upload Ảnh

Ảnh phải upload trước, sau đó dùng `secureUrl` trong create/update place, review, post, avatar.

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/uploads/image` | Có | `multipart/form-data`, field `file` | Một asset |
| POST | `/api/uploads/images` | Có | `multipart/form-data`, field `files`, tối đa 10 ảnh | Mảng asset |
| DELETE | `/api/uploads/image` | Có | `{ "publicId": "..." }` | Cloudinary delete result |

Asset response:

```ts
{
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  status: 'temporary' | 'attached' | 'deleted';
}
```

Giới hạn mỗi ảnh: 5MB.

## Places

### Place Object

```ts
type Place = {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: PlaceCategory;
  address: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  owner: string | { _id: string; name: string; email: string; role: UserRole };
  status: PlaceStatus;
  moderationReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  images: string[];
  tags: string[];
  ratingAverage: number;
  ratingCount: number;
  openingHours?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};
```

### Public Endpoints

| Method | Path | Auth | Mục đích |
|---|---|---|---|
| GET | `/api/places` | Không | Danh sách place đã published |
| GET | `/api/places/:identifier` | Không | Chi tiết place bằng `_id` hoặc `slug` |

Query:

```ts
{
  page?: number;
  limit?: number;
  q?: string;
  category?: PlaceCategory;
  longitude?: number;
  latitude?: number;
  radiusMeters?: number; // 100..50000, default 5000
}
```

### Owner/Admin Endpoints

| Method | Path | Auth | Role | Mục đích |
|---|---|---|---|---|
| GET | `/api/places/manage` | Có | owner/admin | Danh sách place quản lý |
| GET | `/api/places/manage/:identifier` | Có | owner/admin | Chi tiết place quản lý |
| POST | `/api/places` | Có | owner/admin | Tạo place |
| PATCH | `/api/places/:identifier` | Có | owner/admin | Cập nhật place |
| DELETE | `/api/places/:identifier` | Có | owner/admin | Xoá place |
| POST | `/api/places/:identifier/approve` | Có | admin | Duyệt place |
| POST | `/api/places/:identifier/reject` | Có | admin | Từ chối place |
| POST | `/api/places/:identifier/suspend` | Có | admin | Suspend place |

Payload create/update:

```json
{
  "name": "HanoiGo Cafe",
  "description": "A quiet cafe near Hoa Lac.",
  "category": "cafe",
  "address": "Hoa Lac, Hanoi",
  "longitude": 105.525,
  "latitude": 21.013,
  "images": ["https://res.cloudinary.com/.../image.jpg"],
  "tags": ["coffee", "study"],
  "openingHours": {
    "monday": "08:00-22:00",
    "sunday": "09:00-21:00"
  }
}
```

Rule nghiệp vụ:

- User thường không tạo place được.
- Muốn tạo place: user phải gửi owner request và được admin approve.
- Owner tạo place sẽ có status `pending_review`.
- Admin tạo place sẽ có status `published`.
- Owner sửa place đã published sẽ đưa lại về `pending_review`.
- Public chỉ thấy `published`.
- Owner bị giới hạn số place theo `placeLimit`.

## Reviews

| Method | Path | Auth | Role | Mục đích |
|---|---|---|---|---|
| GET | `/api/places/:placeIdentifier/reviews` | Không | any | Review của place |
| POST | `/api/places/:placeIdentifier/reviews` | Có | user/owner/admin | Tạo review |
| PATCH | `/api/reviews/:reviewId` | Có | author/admin | Sửa review |
| DELETE | `/api/reviews/:reviewId` | Có | author/admin | Xoá review |
| POST | `/api/reviews/:reviewId/report` | Có | any | Report review |
| POST | `/api/reviews/:reviewId/reply` | Có | owner/admin | Owner trả lời review |
| PATCH | `/api/reviews/:reviewId/hide` | Có | admin | Ẩn review |
| PATCH | `/api/reviews/:reviewId/unhide` | Có | admin | Hiện lại review |

Payload create:

```json
{
  "rating": 5,
  "comment": "Great place for studying.",
  "images": ["https://res.cloudinary.com/.../review.jpg"]
}
```

Rule:

- Mỗi user chỉ review một lần cho một place.
- Owner không được review place của chính mình.
- Rating từ 1 đến 5.
- Khi review thay đổi, backend tự cập nhật `ratingAverage` và `ratingCount` của place.

## Itineraries

| Method | Path | Auth | Mục đích |
|---|---|---|---|
| GET | `/api/itineraries` | Có | Lịch trình của tôi |
| GET | `/api/itineraries/public` | Không | Lịch trình public |
| POST | `/api/itineraries/generate` | Có | Tạo itinerary bằng Gemini/cache/fallback |
| PATCH | `/api/itineraries/:id/visibility` | Có | Đổi visibility |
| POST | `/api/itineraries/:id/clone` | Có | Clone public/unlisted itinerary |

Payload generate:

```json
{
  "area": "Hoa Lac, Hanoi",
  "days": 2,
  "budgetVnd": 1000000,
  "preferences": ["cafe", "study", "local food"],
  "longitude": 105.525,
  "latitude": 21.013,
  "radiusMeters": 10000
}
```

Itinerary response chính:

```ts
{
  _id: string;
  user: string | { _id: string; name: string; avatarUrl?: string };
  title: string;
  area: string;
  days: number;
  budgetVnd: number;
  preferences: string[];
  places: Place[];
  plan: {
    summary?: string;
    days?: Array<{
      day: number;
      theme: string;
      items: Array<{
        time: string;
        placeName: string;
        activity: string;
        estimatedCostVnd: number;
      }>;
    }>;
    tips?: string[];
    [key: string]: unknown;
  };
  source: ItinerarySource;
  visibility: ItineraryVisibility;
  cloneCount: number;
  clonedFrom?: string;
  expiresAt: string;
}
```

Rule:

- Có monthly quota theo `monthlyItineraryLimit`.
- Nếu thiếu `GEMINI_API_KEY`, backend vẫn trả itinerary bằng fallback logic.
- Generate có cache theo area/days/budget/preferences/location/radius.
- Clone itinerary luôn tạo bản `private`.

## Notifications

Tất cả route notification cần login.

| Method | Path | Role | Mục đích |
|---|---|---|---|
| GET | `/api/notifications` | any | Notification của user |
| PATCH | `/api/notifications/:id/read` | any | Đánh dấu đã đọc |
| PATCH | `/api/notifications/read-all` | any | Đánh dấu tất cả đã đọc |
| POST | `/api/notifications` | admin | Tạo notification cho user |

Payload admin create:

```json
{
  "recipient": "userObjectId",
  "title": "Subscription updated",
  "message": "Your plan is now Pro.",
  "type": "subscription",
  "metadata": {
    "plan": "pro"
  }
}
```

Backend tự tạo notification khi itinerary generate thành công.

## Social / Community

### Post Object

```ts
type SocialPost = {
  _id: string;
  author: string | { _id: string; name: string; avatarUrl?: string };
  place: string | {
    _id: string;
    name: string;
    slug: string;
    category: PlaceCategory;
    address: string;
    ratingAverage: number;
  };
  content: string;
  type: PostType;
  status: PostStatus;
  images: string[];
  tags: string[];
  visitDate?: string;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  reportCount: number;
  createdAt: string;
  updatedAt: string;
};
```

### Feed Và Post

| Method | Path | Auth | Mục đích |
|---|---|---|---|
| GET | `/api/social/feed` | Không | Feed public, sort theo like/comment/save/createdAt |
| GET | `/api/social/feed/following` | Có | Feed từ user đang follow |
| GET | `/api/social/places/:placeId/posts` | Không | Feed theo place |
| GET | `/api/social/posts/:id` | Không | Chi tiết post |
| POST | `/api/social/posts` | Có | Tạo post |
| PATCH | `/api/social/posts/:id` | Có | Sửa post của mình/admin |
| DELETE | `/api/social/posts/:id` | Có | Soft delete post |

Query feed:

```ts
{
  page?: number;
  limit?: number;
  placeId?: string;
  authorId?: string;
  type?: PostType;
  tag?: string;
}
```

Payload create/update:

```json
{
  "placeId": "placeObjectId",
  "content": "Cafe này hợp để làm việc buổi chiều.",
  "type": "experience",
  "images": ["https://res.cloudinary.com/.../post.jpg"],
  "tags": ["cafe", "work"],
  "visitDate": "2026-05-23T08:00:00.000Z"
}
```

Rule:

- Chỉ post vào place `published`.
- Ảnh phải upload trước qua upload API.
- Delete post là soft delete (`status = deleted`).

### Like / Save / Comment / Follow

| Method | Path | Auth | Response |
|---|---|---|---|
| POST | `/api/social/posts/:id/like` | Có | `{ "liked": true }` |
| DELETE | `/api/social/posts/:id/like` | Có | `{ "liked": false }` |
| POST | `/api/social/posts/:id/save` | Có | `{ "saved": true }` |
| DELETE | `/api/social/posts/:id/save` | Có | `{ "saved": false }` |
| GET | `/api/social/posts/:id/comments` | Không | Mảng comment |
| POST | `/api/social/posts/:id/comments` | Có | Comment mới |
| DELETE | `/api/social/comments/:id` | Có | `{ "deleted": true }` |
| POST | `/api/social/follows/:userId` | Có | `{ "following": true }` |
| DELETE | `/api/social/follows/:userId` | Có | `{ "following": false }` |

Payload comment:

```json
{
  "content": "Mình cũng từng đến đây.",
  "parentCommentId": "optionalParentCommentObjectId"
}
```

### Report Và Moderation

| Method | Path | Auth | Role | Mục đích |
|---|---|---|---|---|
| POST | `/api/social/posts/:id/report` | Có | any | Report post |
| POST | `/api/social/comments/:id/report` | Có | any | Report comment |
| PATCH | `/api/social/posts/:id/hide` | Có | admin | Ẩn post |
| PATCH | `/api/social/posts/:id/unhide` | Có | admin | Hiện post |
| PATCH | `/api/social/comments/:id/hide` | Có | admin | Ẩn comment |
| PATCH | `/api/social/comments/:id/unhide` | Có | admin | Hiện comment |

Payload report:

```json
{
  "reason": "Spam or inappropriate content"
}
```

## Luồng Frontend Nên Implement

### Auth UI

1. Register form: name, email, password.
2. Sau register chuyển sang verify OTP screen.
3. Verify OTP thành công: lưu `accessToken`, `refreshToken`, user.
4. Login thường: nếu lỗi `403 Please verify your email before login`, chuyển sang resend/verify OTP.
5. Forgot password: nhập email, nhập OTP + new password.
6. Google login: lấy `idToken` từ Google SDK, gọi `/auth/login/google`.
7. Interceptor API:
   - Gắn Bearer token.
   - Nếu gặp `401`, gọi `/auth/refresh`.
   - Nếu refresh thành công, retry request.
   - Nếu refresh fail, clear token và đưa về login.

### Owner Flow

1. User gửi owner request.
2. Admin duyệt owner request.
3. User role đổi thành `owner`.
4. Owner upload ảnh.
5. Owner create place với `images` là `secureUrl`.
6. Place ở `pending_review`.
7. Admin approve place.
8. Place public mới xuất hiện trong `/places`.

### Discovery Flow

1. Search/list place bằng `/places?q=&category=&longitude=&latitude=&radiusMeters=`.
2. Click place detail bằng slug hoặc id.
3. Load review bằng `/places/:identifier/reviews`.
4. User login mới được review/report.

### Itinerary Flow

1. User chọn days, budget, preferences, location.
2. Gọi `/itineraries/generate`.
3. Hiển thị `plan.days`.
4. Cho user đổi visibility nếu muốn share.
5. Public page dùng `/itineraries/public`.
6. User khác có thể clone public/unlisted itinerary.

### Social Flow

1. Feed chính dùng `/social/feed`.
2. Feed theo place dùng `/social/places/:placeId/posts`.
3. Create post cần place published và ảnh đã upload.
4. Like/save/comment/report dùng endpoint tương ứng.
5. Following feed chỉ hoạt động khi đã login.

## Gợi Ý TypeScript Client

```ts
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const accessToken = localStorage.getItem('accessToken');
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => null);
    throw error ?? new Error(`Request failed with ${res.status}`);
  }

  return res.json() as Promise<T>;
}
```

Upload ảnh:

```ts
async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<{
    publicId: string;
    secureUrl: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
    status: string;
  }>('/uploads/image', {
    method: 'POST',
    body: formData,
  });
}
```

## Checklist Màn Hình Frontend

- Auth:
  - Login email/password.
  - Register.
  - Verify OTP.
  - Resend OTP countdown 60s.
  - Forgot/reset password.
  - Google login.
  - Change password.
- User:
  - Profile.
  - Avatar upload/update.
  - Quota display.
  - Owner request form.
- Place:
  - Public listing/search/filter/map.
  - Place detail.
  - Owner dashboard: manage list, create/edit/delete.
  - Admin moderation: pending/reject/approve/suspend.
- Review:
  - List reviews.
  - Create/edit/delete own review.
  - Report review.
  - Owner reply.
- Itinerary:
  - Generate form.
  - My itineraries.
  - Public itineraries.
  - Visibility selector.
  - Clone.
- Social:
  - Public feed.
  - Place feed.
  - Following feed.
  - Create/edit/delete post.
  - Like/save/comment/report.
  - Follow/unfollow user.
- Notification:
  - Notification dropdown/page.
  - Mark read / read all.
- Admin:
  - User list.
  - Role/subscription management.
  - Owner request queue.
  - Place moderation.
  - Content moderation.

## Lưu Ý Hiện Tại

- Một số list endpoint trả mảng trực tiếp, chưa trả `{ data, total, page }`. Frontend nếu cần infinite scroll có thể dùng `page`/`limit` và dừng khi response length `< limit`.
- Backend chưa có endpoint riêng để lấy saved posts hoặc followers/following list.
- Backend chưa có realtime notification/WebSocket.
- Backend chưa có payment gateway thật cho subscription.
- Swagger ở `/docs` là nguồn kiểm tra nhanh payload/route khi frontend cần verify.
