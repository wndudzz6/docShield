## 🧩 Project Name — **RISK ZERO AI (마스킹테이프)**

> “정확하고 안전한 AI 활용을 위한 기업 보안 프레임워크”

### 📌 개요 (Overview)

**RISK ZERO AI**는 생성형 AI 사용 시 발생할 수 있는 **민감정보 유출 문제를 해결**하기 위해 설계된 보안 프레임워크입니다.
Spring Boot 백엔드가 문서를 **Python FastAPI 기반 Local LLM 서버**로 전달하여
민감 정보를 **자동 탐지 및 마스킹(masking)** 한 뒤,
마스킹된 문서를 기반으로 **Gemini API를 통해 보안 걱정 없는 질의응답**을 수행합니다.

---

### ⚙️ 시스템 구조 (Architecture)

```
[사용자]
   │
   ▼
[Spring Boot API]
  ├─ 문서 업로드 (/api/upload)
  ├─ 마스킹 결과 조회 (/api/result/{id})
  ├─ 질의응답 요청 (/api/ask)
   │
   ▼
[Python FastAPI (Local LLM)]
  ├─ 문서 내용 분석 및 카테고리 분류
  ├─ 개인정보/중요정보 자동 탐지
  ├─ [MASKED] 처리 후 JSON 반환
   │
   ▼
[Gemini API]
  ├─ 마스킹된 문서 기반 안전한 답변 생성
  ├─ 결과를 Spring Boot로 반환하여 렌더링
```

---

### 🧠 주요 기능 (Features)

| 기능                | 설명                                                |
| ----------------- | ------------------------------------------------- |
| **문서 업로드**        | TXT, PDF, DOCX 등 문서를 업로드하여 분석                     |
| **민감정보 자동 탐지**    | Local LLM이 이름, 이메일, 전화번호 등 PII 탐지 후 `[MASKED]` 처리 |
| **문서 카테고리 자동 분류** | HR, BUSINESS, TECH, PERSONAL, PUBLIC 등으로 분류       |
| **보안형 질의응답**      | 마스킹된 문서를 Gemini API로 전달하여 안전하게 질의응답 수행            |
| **Markdown 시각화**  | 프론트엔드에서 마스킹 결과 및 Gemini 응답을 Markdown으로 렌더링        |
| **결과 관리**         | 문서별 ID(UUID) 기반으로 업로드-결과-질의응답 연동 관리               |

---

### 🧩 기술 스택 (Tech Stack)

#### 🧱 Backend

* **Spring Boot 3.x**

  * RestController 기반 API 서버
  * `RestTemplate`으로 Python 서버 통신
  * `ResponseEntity`, `@Value` 기반 설정 관리
* **Python FastAPI**
* 
  * Local LLM (예: gemma, mistral, llama 등) 기반 마스킹 처리
  * Pydantic 모델 검증 및 JSON 응답
  * Gemini API 호출용 모듈 포함 (`google.generativeai`)
* **Gemini API**

  * 문맥 기반 안전 질의응답
  * 마스킹된 데이터로만 응답 생성

#### 🗄️ Infra

* Localhost 기반 통신 (`Spring Boot :8080 ↔ FastAPI :8000`)
* CORS 설정 및 JSON 직렬화 통합 관리
* Markdown 렌더링 (marked.js + DOMPurify)

#### 💻 Frontend

* HTML5 + JavaScript
* 파일 업로드 / Markdown 결과 시각화 / 탭 전환 UI

---

### 🧰 주요 코드 구성 (Core Structure)

```
📁 src
 ├─ main
 │   ├─ java/com/secureai/docshield
 │   │   ├─ controller/DocumentController.java     ← 문서 업로드·질의응답 API
 │   │   ├─ service/AiPromptService.java           ← Gemini API 호출 및 문서 타입 매핑
 │   │   ├─ service/ResponseFormatter.java         ← Python 응답(JSON) 파싱
 │   │   └─ dto/PythonResponse.java                ← Python → Java 응답 DTO
 │   └─ resources/
 │       ├─ static/
 │       │   ├─ index.html                         ← UI 메인 페이지
 │       │   ├─ app.js                             ← 프론트엔드 로직 (파일 업로드·질의·렌더링)
 │       │   └─ style.css                          ← 페이지 스타일 정의
 │       └─ application.yml                        ← 서버 설정 (Gemini API Key, 포트 등)
 └─ test/                                       )

```

---

### 🧑‍💻 실행 방법 (How to Run)

#### ✅ 1. Python 서버 실행

```bash
cd python_server/
uvicorn main:app --reload --port 8000
```

#### ✅ 2. Spring Boot 서버 실행

```bash
./gradlew bootRun
```

#### ✅ 3. 웹 접근

```
http://localhost:8080
```

문서 업로드 후 자동으로 마스킹 및 카테고리 분류가 수행되고,
이후 마스킹된 문서에 대해 Gemini 질의응답이 가능합니다.

---

### 🔒 보안 설계 포인트 (Security Highlights)

* 민감정보(Personal/HR/Business/Tech) 자동 탐지 및 비가역 마스킹
* Gemini 질의 시 마스킹된 텍스트만 전달 → 원본 노출 불가
* Local LLM 기반 오프라인 처리 → 클라우드 전송 최소화
* 문서별 UUID 관리 및 세션 단위 격리

---

### 🌱 향후 확장 계획 (Future Work)

* Vector DB 기반 문서 검색 추가 (ChromaDB or Pinecone)
* Role-Based Access Control (RBAC) 확장
* 기업용 콘솔 UI 및 보고서 자동 생성 기능
* 다국어 문서 자동 분류 및 마스킹 확장

---

### 👥 팀 소개 (Team)

| 이름      | 소속                | 역할                                   |
| ------- | ----------------- | ------------------------------------ |
| **김나은** | 성균관대 컬처앤테크놀로지융합전공 | 기획 · 발표 · 자료 정리                      |
| **김성현** | 순천향대 사물인터넷학과      | 프론트엔드(UI) 개발 · 기획 보조                 |
| **서유민** | 호서대 컴퓨터공학부        | Local LLM / Python FastAPI 개발        |
| **오주영** | 경기대 컴퓨터공학부        | Spring Boot 백엔드 · FastAPI 연동 · FE 연동 |
| **조수아** | 한신대 AI SW계열       | 자료 조사 · 레퍼런스 분석                      |

---

### 🏆 수상 및 발표

> 2025 AI 해커톤(경기대학교, 성균관대학교, 순천향대학교, 한신대학교, 호서대학교) 장려상
> “**RISK ZERO AI — 정확하고 안전한 AI 활용을 위한 기업 보안 프레임워크**”

---

