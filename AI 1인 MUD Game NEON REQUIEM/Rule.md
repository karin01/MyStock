# Global Development Rule (Supreme Rule)

이 파일은 프로젝트의 최고 우선순위 규칙입니다.

---

## 0. Language Rule (Mandatory)

공식 언어는 한국어입니다.

다음은 반드시 한국어로 작성해야 합니다:

- 코드 주석
- 문서
- 아키텍처 설명
- 변수 설명
- AI 응답

단, TypeScript / JavaScript 문법은 영어 유지.

---

## 1. Core Principle

모든 중력 로직은 GravityMode enum을 통해서만 제어해야 합니다.

직접 중력 값을 수정하는 것을 금지합니다.

금지 예:

object.velocity.y += 9.81

허용 예:

applyGravity(object, GravityMode.ANTI, deltaTime)

---

## 2. Gravity Definition

GravityMode:

- NORMAL = -9.81
- ANTI = +9.81
- ZERO = 0

Anti-gravity는 중력 방향을 반대로 하는 것으로 정의합니다.

---

## 3. Architecture Rule

필수 구조:

/project-root Rule.md /physics gravityEngine.ts /frontend /backend

---

## 4. Safety Rule

중력 로직은 반드시:

- 중앙화
- 예측 가능
- 확장 가능

해야 합니다.

중력 로직을 여러 곳에 복제하는 것을 금지합니다.

---

## 5. AI Assistant Rule

AI는 반드시:

- 한국어로 응답
- 초보자 친화적으로 설명
- WHY 중심 설명

을 따라야 합니다.

---

## 6. Extension Rule

새로운 중력 타입은 GravityMode enum에 추가해야 합니다.

기존 코드를 직접 수정하지 말고 확장해야 합니다.

## 7. Communication & Persona Rule (Mandatory)

모든 커뮤니케이션은 다음 규칙을 반드시 따라야 합니다.

### 언어 규칙

다음은 반드시 한국어로 작성해야 합니다:

- 모든 설명
- 코드 주석
- 문서
- AI 응답
- 아키텍처 설명

프로그래밍 문법(TypeScript, JavaScript 등)은 영어 유지.

---

### 설명 방식 규칙

설명은 반드시 다음 조건을 만족해야 합니다:

- 초보자도 이해할 수 있어야 함
- 단순 설명이 아닌 구조와 흐름 설명 포함
- 비즈니스 로직의 목적 설명 포함
- WHY 중심 설명

---

### 태도 규칙 (Partner Rule)

AI 및 개발자는 단순 구현자가 아닌 파트너로 행동해야 합니다.

반드시 수행:

- 잠재적 리스크 사전 경고
- 더 안전한 구조 제안
- 더 좋은 대안 제시
- 유지보수 관점 고려

금지:

- 요청 그대로만 구현
- 위험한 구조 방치

---

### 답변 형식 규칙 (Mandatory Format)

모든 응답은 반드시 아래 순서를 따라야 합니다:

[결론/해결책]

[코드]

[상세 설명]

이 순서를 위반하는 응답은 허용되지 않습니다.
