package com.secureai.docshield.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.List;

@Service
public class AiPromptService {

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${gemini.api.key}")
    private String geminiApiKey;

    @Value("${gemini.model.name:gemini-2.5-flash}")
    private String geminiModel;

    public String askGemini(String markdownDoc, String question, String documentType) {
        String url = String.format(
                "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
                geminiModel, geminiApiKey
        );

        String referenceContent = "";
        try {
            String fileName = switch (documentType) {
                case "HR_INFO" -> "HRsearchTest.txt";
                case "BUSINESS_INFO" -> "BusinessSearchTest.txt";
                case "TECH_INFO" -> "TechSearchTest.txt";
                case "PERSONAL_INFO" -> "PersonalSearchTest.txt";
                case "PUBLIC_INFO" -> "PublicSearchTest.txt";
                default -> null;
            };

            if (fileName != null) {
                var resource = new org.springframework.core.io.ClassPathResource(fileName);
                referenceContent = java.nio.file.Files.readString(resource.getFile().toPath());
                System.out.println("📄 참조 문서 로드 완료: " + fileName);
            }
        } catch (Exception e) {
            System.err.println("⚠️ 참조 문서 로드 실패: " + e.getMessage());
        }

        // 🧩 프롬프트
        String systemPrompt = String.format("""
        당신은 기업 문서를 분석하는 전문 분석가입니다.
        문서 유형: %s

        문서는 이미 일부 정보가 마스킹되어 있습니다. 복원은 필요하지 않습니다.
        사용자의 질문에 따라 문서의 내용, 패턴, 의미를 분석하고 Markdown 형식으로 정리하세요.

        [출력 형식 - Markdown 전용]
        - 백틱(```)이나 JSON 코드는 사용하지 마세요.
        - 제목, 요약, 주요 내용, 패턴 및 추가 분석 제안을 구분해서 작성하세요.
        """, documentType, referenceContent);

        Map<String, Object> body = Map.of(
                "contents", List.of(
                        Map.of("role", "model", "parts", List.of(Map.of("text", systemPrompt))),
                        Map.of("role", "user", "parts", List.of(Map.of("text",
                                "문서(Markdown):\n" + markdownDoc + "\n\n질문: " + question)))
                )
        );



        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(url, entity, String.class);

            // ✅ JSON 응답에서 Markdown 텍스트만 추출
            ObjectMapper mapper = new ObjectMapper();
            JsonNode root = mapper.readTree(response.getBody());
            String markdown = root.path("candidates")
                    .get(0)
                    .path("content")
                    .path("parts")
                    .get(0)
                    .path("text")
                    .asText();

            System.out.println("✅ Gemini 응답 파싱 성공: " +
                    Math.min(markdown.length(), 80) + "자 미리보기 -> " +
                    markdown.substring(0, Math.min(markdown.length(), 80)).replace("\n", " ") + "...");

            return markdown;

        } catch (Exception e) {
            System.err.println("❌ Gemini 호출 실패: " + e.getMessage());
            return "⚠️ Gemini 호출 중 오류 발생: " + e.getMessage();
        }
    }
}
