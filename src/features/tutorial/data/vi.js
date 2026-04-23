export const vi = {
  soroban: {
    title: "Tìm hiểu về Soroban 👋",
    intro: "Nói một cách đơn giản, Soroban là một nền tảng hợp đồng thông minh thế hệ mới được xây dựng trên mạng Stellar. Nếu bạn muốn xây dựng dApps nhanh và bảo mật, đây là nơi dành cho bạn!",
    sections: [
      {
        sub: "Tại sao chọn Soroban?",
        text: "Stellar từng tập trung hoàn toàn vào thanh toán, nhưng với Soroban, nó đã trở nên mạnh mẽ hơn nhiều. Nó được thiết kế để xử lý các logic phức tạp mà không làm chậm mạng lưới.",
      },
      {
        sub: "Thông tin kỹ thuật",
        text: "Đối với các nhà phát triển, đây là lý do tại sao Soroban tuyệt vời:",
        list: ["**Sử dụng Rust:** Soroban sử dụng **Rust**, một ngôn ngữ nổi tiếng về an toàn bộ nhớ và tốc độ.", "**Wasm Runtime:** Tất cả mã của bạn được biên dịch sang **WebAssembly (Wasm)**. Điều này có nghĩa là hợp đồng thông minh của bạn chạy với hiệu suất tối đa.", "**Không State Bloat:** Soroban sử dụng giải pháp lưu trữ trạng thái mới để giữ cho sổ cái luôn gọn nhẹ.", "**Tích hợp Native:** Soroban là **native** của Stellar. Không cần cầu nối phức tạp hay các lớp bổ sung."],
      },
    ],
    note: "Nói ngắn gọn: Soroban là sự kết hợp hoàn hảo giữa tốc độ của Stellar và khả năng lập trình của Rust.",
  },
  variable: {
    title: "Biến và Hệ thống kiểu dữ liệu",
    intro: "Rust là một ngôn ngữ lập trình mạnh về kiểu dữ liệu. Điều này đảm bảo an toàn bộ nhớ và hiệu suất cao cho các hợp đồng thông minh của bạn.",
    sections: [
      {
        sub: "Biến (let vs let mut)",
        text: "Theo mặc định, các biến trong Rust là bất biến. Sử dụng từ khóa `mut` để tạo một biến có thể thay đổi.",
        code: "let x = 5; // Bất biến\nlet mut y = 10; // Có thể thay đổi\ny = 15;",
      },
      {
        sub: "Kiểu dữ liệu số",
        text: "Soroban hỗ trợ nhiều kích thước số nguyên khác nhau:",
        list: ["**u32 / i32:** Số nguyên 32-bit.", "**u64 / i64:** Thường dùng cho số lượng token hoặc ID.", "**u128 / i128:** Dùng cho các con số cực lớn."],
      },
    ],
    note: "Chọn đúng kiểu dữ liệu là rất quan trọng để tiết kiệm phí gas trên mạng Stellar.",
  },
  studio: {
    title: "Soroban Studio: IDE trực tuyến",
    intro: "Soroban Studio là một IDE dựa trên đám mây được thiết kế để đơn giản hóa quy trình phát triển của bạn. Bắt đầu xây dựng mà không cần thiết lập môi trường cục bộ phức tạp.",
    sections: [
      {
        sub: "Soroban Studio là gì?",
        text: "Chúng tôi cung cấp các công cụ tối ưu cho hệ sinh thái Stellar. Viết mã, biên dịch hợp đồng và mô phỏng giao dịch—tất cả trực tiếp trong trình duyệt của bạn.",
      },
      {
        sub: "Các tính năng chính",
        text: "Được thiết kế cho năng suất của nhà phát triển:",
        list: ["**Trình soạn thảo mã nâng cao:** Nhẹ nhưng mạnh mẽ với chức năng tự động hoàn thành Rust.", "**Terminal tích hợp:** Truy cập trực tiếp vào các lệnh `stellar` và `cargo`.", "**Triển khai một lần nhấp:** Dễ dàng triển khai lên Testnet.", "**Tích hợp GitHub:** Đồng bộ hóa mã nguồn của bạn thông qua GitHub."],
      },
    ],
    note: "Xây dựng trên Stellar với hiệu quả tối đa thông qua Soroban Studio.",
  },
  contract: {
    title: "Cấu trúc hợp đồng thông minh Soroban",
    intro: "Phát triển hợp đồng thông minh trong Soroban đòi hỏi sự hiểu biết về cấu trúc cơ bản của mã Rust được tối ưu hóa cho blockchain.",
    sections: [
      {
        sub: "1. Khai báo SDK",
        text: "Mọi hợp đồng Soroban đều bắt đầu bằng cấu hình môi trường:",
        code: "#![no_std]\nuse soroban_sdk::{contract, contractimpl, Env};",
        list: ["**#![no_std]:** Yêu cầu Rust không sử dụng thư viện tiêu chuẩn để giữ cho file Wasm nhỏ gọn.", "**soroban_sdk:** Các macro và kiểu dữ liệu cốt lõi từ SDK Stellar."],
      },
      {
        sub: "2. Cấu trúc hợp đồng",
        text: "Định nghĩa danh tính hợp đồng của bạn bằng một struct:",
        code: "#[contract]\npub struct NotesContract;",
      },
    ],
    note: "Đảm bảo mọi hàm công khai đều nằm trong khối impl được đánh dấu bằng #[contractimpl].",
  },
  structure: {
    title: "Cấu trúc dự án Soroban",
    intro: "Hiểu rõ các thư mục và tệp tin là nền tảng để quản lý dự án của bạn một cách hiệu quả.",
    sections: [
      {
        sub: "Các thư mục chính",
        text: "Một dự án Soroban điển hình có ba thư mục chính:",
        list: ["**contracts/**: Chứa mã nguồn Rust của bạn.", "**frontend/**: Thư mục tùy chọn cho mã giao diện web.", "**target/**: Chứa các tệp biên dịch được tạo tự động."],
      },
    ],
    note: "Luôn giữ mã nguồn hợp đồng của bạn trong thư mục 'contracts' để biên dịch thành công.",
  },
  struct: {
    title: "Quản lý dữ liệu phức tạp với Struct",
    intro: "Trong hợp đồng thông minh, chúng ta thường nhóm các thông tin liên quan thành một thực thể duy nhất. Trong Rust, chúng ta sử dụng **Struct**.",
    sections: [
      {
        sub: "Khái niệm Struct",
        text: "Struct là một kiểu dữ liệu tùy chỉnh cho phép bạn lưu trữ nhiều giá trị liên quan trong một đối tượng.",
      },
      {
        sub: "Triển khai trong Soroban",
        text: "Để sử dụng Struct trong Soroban, chúng ta thêm các thuộc tính cụ thể:",
        code: "#[contracttype]\n#[derive(Clone, Debug)]\npub struct Note {\n    pub id: u64,\n    pub title: String,\n    pub content: String,\n}",
      },
    ],
    note: "Sử dụng Struct bất cứ khi nào bạn có một tập hợp dữ liệu liên quan để giữ cho mã nguồn có tính module.",
  },
  function: {
    title: "Triển khai các hàm trong hợp đồng",
    intro: "Hàm là cốt lõi của logic kinh doanh. Thông qua chúng, người dùng tương tác với hợp đồng để thực hiện các hành động hoặc đọc dữ liệu.",
    sections: [
      {
        sub: "Vai trò của hàm",
        text: "Các hàm đóng vai trò là cầu nối giữa người dùng và mã nguồn hợp đồng.",
      },
      {
        sub: "Tham số đầu vào",
        text: "Các tham số là điểm nhập cho dữ liệu do người dùng cung cấp.",
      },
    ],
    note: "Thiết kế các hàm của bạn theo tính module với các trách nhiệm cụ thể để bảo mật tốt hơn.",
  },
  storage: {
    title: "Quản lý dữ liệu bền vững",
    intro: "Khác với các biến thông thường, **Storage** được sử dụng để lưu trữ dữ liệu vĩnh viễn trên blockchain Stellar.",
    sections: [
      {
        sub: "Khái niệm lưu trữ Key-Value",
        text: "Soroban sử dụng mô hình key-value. Hãy tưởng tượng bộ nhớ như một tủ hồ sơ khổng lồ.",
        list: ["**Key:** Nhãn duy nhất (thường là `Symbol`).", "**Value:** Chính dữ liệu đó.", "**Truy cập:** Thông qua đối tượng `env.storage()`."],
      },
      {
        sub: "Thao tác cơ bản: Get và Set",
        code: `// Đọc và ghi đơn giản
let KEY = Symbol::new(&env, "SCORE");
env.storage().instance().set(&KEY, &100); // Set
let score: u32 = env.storage().instance().get(&KEY).unwrap_or(0); // Get`,
      },
    ],
    note: "Lưu trữ dữ liệu trên blockchain sẽ phát sinh phí. Hãy tiết kiệm và chỉ lưu trữ những gì cần thiết.",
  },
  wallet: {
    title: "Quản lý danh tính kỹ thuật số với Ví",
    intro: "Ví là một thành phần cơ bản của hệ sinh thái blockchain. Nó hoạt động như một kho lưu trữ tài sản và danh tính duy nhất của bạn.",
    sections: [
      {
        sub: "Ví Stellar là gì?",
        text: "Ví là công cụ bạn dùng để ký kỹ thuật số các giao dịch. Mỗi ví có một địa chỉ công khai dùng làm danh tính của bạn.",
      },
      {
        sub: "Cài đặt ví Freighter",
        text: "Freighter là tiện ích mở rộng trình duyệt tiêu chuẩn cho mạng Stellar.",
        image: "/tutorials/freighter.png",
        links: [{ label: "Tải ví Freighter", url: "https://www.freighter.app/" }],
      },
    ],
    note: "Không bao giờ chia sẻ 'Secret Key' của bạn. Bất kỳ ai có quyền truy cập đều có toàn quyền kiểm soát tài sản của bạn.",
  },
  deploy: {
    title: "Triển khai hợp đồng lên Testnet",
    intro: "Bước cuối cùng trong quy trình là xuất bản hợp đồng thông minh của bạn lên blockchain.",
    sections: [
      {
        sub: "1. Chuẩn bị ví và tiền",
        text: "Trước khi triển khai, bạn cần một ví có số dư XLM trên Testnet.",
        code: "stellar keys generate alice --network testnet --fund",
      },
      {
        sub: "2. Biên dịch hợp đồng",
        code: "stellar contract build",
      },
      {
        sub: "3. Triển khai lên mạng lưới",
        code: "stellar contract deploy --source-account alice --network testnet",
      },
    ],
    note: "Mọi tương tác làm thay đổi dữ liệu sổ cái đều yêu cầu một khoản phí XLM nhỏ.",
  },
};
