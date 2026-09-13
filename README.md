# Seatwise

Web local giúp random chỗ ngồi trong lớp, lưu dữ liệu ngay trên trình duyệt.

## Chạy local

Không cần cài dependency. Mở `index.html` trực tiếp trong trình duyệt, hoặc chạy một static server trong thư mục này:

```powershell
python -m http.server 5173
```

Sau đó mở http://localhost:5173.

## Tính năng

- Nhớ danh sách học sinh bằng `localStorage`.
- Đánh dấu có mặt / vắng mặt theo từng buổi học.
- Thêm các cặp không được ngồi cạnh nhau.
- Tùy chỉnh số hàng và cột.
- Random sơ đồ chỉ với những bạn có mặt.
- Dữ liệu hoạt động local-first, chưa cần tài khoản hay backend.

Khi đưa lên GitHub Pages, chỉ cần push các file trong thư mục này và bật Pages từ branch chính.
