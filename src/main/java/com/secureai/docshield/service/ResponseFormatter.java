package com.secureai.docshield.service;

import com.fasterxml.jackson.databind.*;
import com.secureai.docshield.dto.*;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ResponseFormatter {

    private final ObjectMapper mapper = new ObjectMapper();

    // 🧩 Python 서버 응답 파싱
    public PythonResponse parsePythonResponse(String json) {
        try {
            return mapper.readValue(json, PythonResponse.class);
        } catch (Exception e) {
            System.err.println("⚠️ Python 응답 파싱 실패: " + e.getMessage());
            // DTO 구조에 맞게 수정
            return new PythonResponse("Error parsing Python response", null);
        }
    }


    // 🤖 Gemini JSON 응답 파싱 (백틱 / 코드블록 제거 포함)
    public ReportResponse parseGeminiJson(String aiResponse) {
        try {
            // ✅ Gemini 기본 구조에서 text 추출
            JsonNode root = mapper.readTree(aiResponse);
            String text = root.path("candidates").get(0)
                    .path("content").path("parts").get(0)
                    .path("text").asText();

            // ✅ 백틱(```)이나 코드블록(````json`) 제거
            String cleaned = text
                    .replaceAll("(?s)```json", "")
                    .replaceAll("(?s)```", "")
                    .replaceAll("(?s)`", "")
                    .trim();

            // ✅ 실제 JSON 파싱
            JsonNode json = mapper.readTree(cleaned);

            // ✅ 기본 필드 매핑
            String summary = json.path("summary").asText("요약 없음");
            List<String> risks = jsonToList(json.path("risks"));
            List<String> recommendations = jsonToList(json.path("recommendations"));

            // ✅ 그 외의 필드들은 extra로 저장
            Map<String, Object> extra = new HashMap<>();
            json.fieldNames().forEachRemaining(name -> {
                if (!Set.of("summary", "risks", "recommendations").contains(name)) {
                    extra.put(name, json.get(name));
                }
            });

            return new ReportResponse(summary, risks, recommendations, extra);

        } catch (Exception e) {
            System.err.println("❌ Gemini 응답 파싱 실패: " + e.getMessage());
            e.printStackTrace();
            return new ReportResponse("AI 응답 파싱 실패", List.of(), List.of(), Map.of("error", e.getMessage()));
        }
    }

    private List<String> jsonToList(JsonNode node) {
        List<String> list = new ArrayList<>();
        if (node.isArray()) node.forEach(item -> list.add(item.asText()));
        return list;
    }
}
