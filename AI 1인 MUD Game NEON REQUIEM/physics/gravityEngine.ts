export enum GravityMode {
  NORMAL = -9.81,
  ANTI = 9.81,
  ZERO = 0,
}

export interface PhysicsObject {
  id: string;
  velocity: { x: number; y: number };
  position: { x: number; y: number };
}

/**
 * 전역 물리 엔진 파이프라인.
 * Object의 중력 상태를 업데이트합니다.
 * @param obj 중력의 영향을 받는 객체
 * @param mode 적용할 GravityMode
 * @param deltaTime 경과 시간 (단위: 초)
 */
export function applyGravity(
  obj: PhysicsObject,
  mode: GravityMode,
  deltaTime: number,
): void {
  // Rule.md에 따라 직접 값 수정 대신 이 함수를 통해서만 중력을 제어해야 합니다.
  obj.velocity.y += mode * deltaTime;
}
