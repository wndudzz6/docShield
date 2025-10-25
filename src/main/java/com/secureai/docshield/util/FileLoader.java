package com.secureai.docshield.util;

import org.springframework.core.io.ClassPathResource;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;

public class FileLoader {

    public static String load(String filename) {
        try {
            var resource = new ClassPathResource(filename);
            return Files.readString(resource.getFile().toPath(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            System.err.println("⚠️ 예시데이터 파일 로드 실패: " + e.getMessage());
            return "";
        }
    }
}
