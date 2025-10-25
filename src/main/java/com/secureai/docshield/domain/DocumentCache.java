package com.secureai.docshield.domain;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class DocumentCache {
    private final Map<String, String> cache = new ConcurrentHashMap<>();

    // ✅ id를 외부에서 전달받도록 수정
    public void save(String id, String content) {
        cache.put(id, content);
    }

    public String get(String id) {
        return cache.get(id);
    }
}
