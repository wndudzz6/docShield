package com.secureai.docshield.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class PythonApiClient {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${python.server.url}")
    private String pythonServerUrl;

    public String sendToPython(String content) {
        Map<String, Object> body = Map.of("content", content);
        Map<String, Object> response =
                restTemplate.postForObject(pythonServerUrl + "/process", body, Map.class);

        try {
            return objectMapper.writeValueAsString(response);
        } catch (Exception e) {
            throw new RuntimeException("Python 응답 직렬화 실패", e);
        }
    }

    public String sendQuestion(String content, String question, String type) {
        Map<String, Object> body = Map.of(
                "masked_json", content,
                "question", question,
                "type", type
        );
        return restTemplate.postForObject(pythonServerUrl + "/ask", body, String.class);
    }
}

