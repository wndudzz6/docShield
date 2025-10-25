package com.secureai.docshield.controller;

import com.secureai.docshield.domain.*;
import com.secureai.docshield.dto.*;
import com.secureai.docshield.repository.DocumentResultRepository;
import com.secureai.docshield.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class DocumentController {

    private final FileParserService fileParserService;
    private final PythonApiClient pythonApiClient;
    private final ResponseFormatter responseFormatter;
    private final DocumentResultRepository repository;
    private final DocumentCache documentCache;
    private final AiPromptService aiPromptService;

    /**
     * 1️⃣ 문서 업로드 → Python 서버로 전송 (보안 마스킹 및 Markdown 생성)
     */
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> upload(@RequestParam MultipartFile file) throws IOException {
        String text = fileParserService.parseFile(file);
        String pythonMarkdown = pythonApiClient.sendToPython(text);
        PythonResponse parsed = responseFormatter.parsePythonResponse(pythonMarkdown);
        DocumentType type = parsed.getDocumentType();
        String fileName = file.getOriginalFilename();

        String id = UUID.randomUUID().toString();
        repository.save(new DocumentResult(id, type, pythonMarkdown, null, fileName));
        documentCache.save(id, text);

        // ✅ JSON으로 감싸서 반환
        Map<String, String> response = new HashMap<>();
        response.put("id", id);

        return ResponseEntity.ok(response);
    }


    /**
     * 2️⃣ 사용자 질문 → Gemini 호출 (Markdown 문서 기반 질의)
     */
    @PostMapping("/ask")
    public ResponseEntity<GenericAiResponse> ask(
            @RequestParam String docId,
            @RequestParam String question
    ) {
        System.out.println("🟢 [ASK 요청 시작]");
        System.out.println("📨 docId = " + docId);
        System.out.println("❓ question = " + question);

        boolean exists = repository.existsById(docId);
        System.out.println("📦 DB 존재 여부: " + exists);

        if (!exists) {
            System.err.println("❌ DB에 해당 문서 없음 — 업로드 후 서버가 재시작되었거나 H2가 메모리 모드일 수 있음");
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new GenericAiResponse("❌ 문서를 찾을 수 없습니다. 업로드가 잘 되었는지 확인하세요."));
        }

        DocumentResult result = repository.findById(docId)
                .orElseThrow(() -> new IllegalArgumentException("❌ 해당 문서를 찾을 수 없습니다."));

        System.out.println("✅ DB 조회 성공: " + result.getFileName());
        System.out.println("📄 DocumentType = " + result.getType());
        System.out.println("📄 PythonMarkdown 길이 = " +
                (result.getPythonMarkdown() != null ? result.getPythonMarkdown().length() : 0));

        // ✅ Gemini 호출
        String maskedMarkdown = result.getPythonMarkdown();
        DocumentType type = result.getType();

        System.out.println("🚀 Gemini 호출 시작...");
        String geminiMarkdown = aiPromptService.askGemini(maskedMarkdown, question, type.name());
        System.out.println("🤖 Gemini 응답 수신 완료 (길이: " + geminiMarkdown.length() + ")");

        // ✅ 결과 저장
        result.setGeminiMarkdown(geminiMarkdown);
        repository.save(result);
        System.out.println("💾 Gemini 결과 DB 저장 완료");

        GenericAiResponse response = new GenericAiResponse(geminiMarkdown);
        System.out.println("✅ [ASK 완료] 응답 전송");
        return ResponseEntity.ok(response);
    }


    /**
     * 3️⃣ Python 결과(Markdown) 조회
     */
    @GetMapping("/result/{id}")
    public ResponseEntity<Map<String, Object>> getPythonResult(@PathVariable String id) {
        DocumentResult result = repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("결과 없음"));

        Map<String, Object> response = new HashMap<>();
        response.put("documentType", result.getType());        // ✅ DB에 저장된 문서 유형
        response.put("markdown", result.getPythonMarkdown());  // ✅ 실제 마스킹 결과 텍스트

        return ResponseEntity.ok(response);
    }

    /**
     * 4️⃣ 카테고리별 문서 목록 조회 (id + fileName만 반환)
     */
    @GetMapping("/documents")
    public ResponseEntity<List<Map<String, String>>> getDocumentsByType(@RequestParam DocumentType type) {
        List<DocumentResult> docs = repository.findAll();

        // type에 해당하는 문서만 필터링 후 단순 구조로 반환
        List<Map<String, String>> response = docs.stream()
                .filter(doc -> doc.getType() == type)
                .map(doc -> Map.of(
                        "id", doc.getId(),
                        "fileName", doc.getFileName()
                ))
                .toList();

        return ResponseEntity.ok(response);
    }
    /**
     * 5️⃣ 문서 타입별 테스트 데이터 조회 (프론트 참고용)
     */
    @GetMapping("/example")
    public ResponseEntity<String> getExampleData(@RequestParam DocumentType type) {
        String fileName = switch (type) {
            case HR_INFO -> "HRsearchTest.txt";
            case BUSINESS_INFO -> "BusinessSearchTest.txt";
            case TECH_INFO -> "TechSearchTest.txt";
            case PERSONAL_INFO -> "PersonalSearchTest.txt";
            case PUBLIC_INFO -> "PublicSearchTest.txt";
        };

        try {
            var resource = new org.springframework.core.io.ClassPathResource(fileName);
            String content = Files.readString(resource.getFile().toPath(), StandardCharsets.UTF_8);
            return ResponseEntity.ok(content);
        } catch (Exception e) {
            System.err.println("⚠️ 예시파일 로드 실패: " + e.getMessage());
            return ResponseEntity.status(500).body("예시 데이터를 불러오지 못했습니다.");
        }
    }
}
