/**
 * 주식 뷰어 물리 엔진 (Stock Viewer Physics Engine)
 * 
 * -------------------------------------------------------------
 * Rule.md의 최고 우선순위 규칙(Supreme Rule)에 따라 작성되었습니다.
 * 
 * [왜 이 엔진이 필요한가요?]
 * 주식 시장의 흐름(차트의 상승과 하락)을 시각적으로 
 * 물리 효과(중력)로 나타내기 위한 중앙 제어 타워입니다.
 * 
 * 중력 값을 개발자가 직접 더하거나 빼면(예: y += 9.81)
 * 코드가 흩어지고 오류를 찾기 힘들어집니다. 
 * 그래서 오직 이 `GravityMode`와 `applyGravity` 함수만을 통해서
 * 안전하게 중력을 제어하도록 설계되었습니다. (단일 책임 원칙)
 * -------------------------------------------------------------
 */

/**
 * 중력의 방향과 세기를 결정하는 기준 모드(Enum)입니다.
 * 
 * NORMAL: 주식이 떨어지는 기본 상태 (아래로 작용, -9.81)
 * ANTI  : 주식이 오르는 반중력 상태 (위로 작용, +9.81)
 * ZERO  : 주식이 횡보하는 무중력 상태 (변화 없음, 0)
 */
export enum GravityMode {
    NORMAL = -9.81,
    ANTI = 9.81,
    ZERO = 0
}

/**
 * 물리 효과가 적용될 객체(차트의 점, UI 요소 등)의 기본 형태입니다.
 */
export interface PhysicalObject {
    id: string; // 객체의 고유 이름
    velocity: {
        x: number;
        y: number; // 세로 방향의 속도 (중력의 영향을 받는 부분)
    };
}

/**
 * 객체에 중력을 안전하게 적용해주는 중앙 통제 함수입니다.
 * 
 * [어떻게 작동하나요?]
 * 1. 객체(object), 중력 모드(mode), 경과 시간(deltaTime)을 입력받습니다.
 * 2. 현재 객체의 세로 속도(velocity.y)에 '모드에 해당하는 중력 × 경과 시간'을 더해줍니다.
 * 3. 이렇게 하면 시간에 따라 자연스럽게 속도가 변하는 물리 법칙이 적용됩니다.
 * 
 * @param object 중력을 받을 물체
 * @param mode 적용할 중력의 종류 (NORMAL, ANTI, ZERO)
 * @param deltaTime 이전 화면과 현재 화면 사이의 시간 간격 (초 단위)
 */
export function applyGravity(object: PhysicalObject, mode: GravityMode, deltaTime: number): void {
    // 안전 장치: 직접 속도를 수정하지 않고 함수를 통해서만 계산합니다.
    const gravityForce = mode;
    object.velocity.y += (gravityForce * deltaTime);
    
    // 이 로그는 개발자가 중력이 잘 적용되고 있는지 볼 수 있도록 돕습니다.
    console.log(`[중력 엔진] 객체(${object.id})에 ${GravityMode[mode]} 중력(${gravityForce})이 ${deltaTime}초 동안 적용되었습니다. 현재 세로 속도: ${object.velocity.y}`);
}
