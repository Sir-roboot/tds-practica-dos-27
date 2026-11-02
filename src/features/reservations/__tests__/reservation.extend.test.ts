import { Reservation } from '../reservation.model';
import { validateExtensionEndTime } from '../reservation.rules';
import { extendReservation, ReservationError } from '../reservation.service';

const now = new Date('2030-01-01T10:00:00Z');
const currentEnd = new Date('2030-01-01T11:00:00Z');
const newEnd = '2030-01-01T12:00:00Z';
const id = '507f1f77bcf86cd799439011';
const spotId = '507f1f77bcf86cd799439012';

describe('regla de extensión', () => {
  test('acepta una fecha posterior para una reservación vigente', () => {
    expect(validateExtensionEndTime(currentEnd, newEnd, now)).toEqual(new Date(newEnd));
  });
  test.each([undefined, null, 123, '', 'no es fecha', '2030-01-01T11:00:00Z', '2030-01-01T10:30:00Z',
    '2030-02-30T12:00:00Z', '2030-01-01T24:00:00Z', '2030-01-01T12:00:00'])(
    'rechaza el valor inválido o no posterior %p', (value) => {
      expect(validateExtensionEndTime(currentEnd, value, now)).toBeNull();
    }
  );
  test('acepta una hora ISO con zona horaria explícita', () => {
    expect(validateExtensionEndTime(currentEnd, '2030-01-01T06:00:00-06:00', now)).toEqual(new Date(newEnd));
  });
  test.each([new Date('2030-01-01T11:00:00Z'), new Date('2030-01-01T11:01:00Z')])(
    'rechaza si el fin ya ocurrió o coincide con ahora (%p)', (clock) => {
      expect(validateExtensionEndTime(currentEnd, newEnd, clock)).toBeNull();
    }
  );
});

describe('servicio de extensión', () => {
  let save: jest.Mock;
  let reservation: any;
  let findById: jest.SpyInstance;
  let exists: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    save = jest.fn().mockResolvedValue({ endTime: new Date(newEnd) });
    reservation = { _id: id, parkingSpotId: spotId, status: 'ACTIVE', endTime: new Date(currentEnd), save };
    findById = jest.spyOn(Reservation, 'findById').mockResolvedValue(reservation as never);
    exists = jest.spyOn(Reservation, 'exists').mockResolvedValue(null);
  });
  afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

  test('guarda el nuevo fin y busca conflictos solo en otras reservas activas del mismo espacio', async () => {
    // Arrange: la reserva está activa, vigente y no hay conflicto.
    // Act
    const result = await extendReservation(id, newEnd);
    // Assert
    expect(result.endTime).toEqual(new Date(newEnd));
    expect(reservation.endTime).toEqual(new Date(newEnd));
    expect(save).toHaveBeenCalledTimes(1);
    expect(exists).toHaveBeenCalledWith({
      _id: { $ne: id }, parkingSpotId: spotId, status: 'ACTIVE',
      startTime: { $lt: new Date(newEnd) }, endTime: { $gt: currentEnd }
    });
  });
  test('rechaza un ID inválido sin consultar ni guardar', async () => {
    await expect(extendReservation('invalido', newEnd)).rejects.toMatchObject({ status: 404 });
    expect(findById).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });
  test('rechaza una reservación inexistente', async () => {
    findById.mockResolvedValue(null);
    await expect(extendReservation(id, newEnd)).rejects.toMatchObject({ status: 404 });
    expect(save).not.toHaveBeenCalled();
  });
  test.each(['CANCELLED', 'FINISHED'])('rechaza estado %s', async (status) => {
    reservation.status = status;
    await expect(extendReservation(id, newEnd)).rejects.toMatchObject({ status: 409 });
    expect(save).not.toHaveBeenCalled();
  });
  test.each([new Date('2030-01-01T09:00:00Z'), now])('rechaza cuando ya terminó (%p)', async (end) => {
    reservation.endTime = end;
    await expect(extendReservation(id, newEnd)).rejects.toMatchObject({ status: 409 });
    expect(save).not.toHaveBeenCalled();
  });
  test.each([null, 'incorrecta', '2030-01-01T11:00:00Z', '2030-01-01T10:30:00Z'])(
    'rechaza fin inválido %p sin guardar', async (end) => {
      await expect(extendReservation(id, end)).rejects.toMatchObject({ status: 400 });
      expect(exists).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
    }
  );
  test('rechaza un conflicto activo sin modificar la reserva', async () => {
    exists.mockResolvedValue({ _id: 'otra' });
    await expect(extendReservation(id, newEnd)).rejects.toBeInstanceOf(ReservationError);
    await expect(extendReservation(id, newEnd)).rejects.toMatchObject({ status: 409 });
    expect(reservation.endTime).toEqual(currentEnd); expect(save).not.toHaveBeenCalled();
  });
});
