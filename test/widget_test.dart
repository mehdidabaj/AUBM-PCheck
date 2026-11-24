import 'package:aubm_pcheck/main.dart';
import 'package:aubm_pcheck/state/app_state.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('Affiche le titre AUBM PCheck', (tester) async {
    final state = AppState();
    // Skip real DB init in widget smoke test.
    state.loading = false;

    await tester.pumpWidget(AubmPCheckApp(state: state));
    expect(find.textContaining('Todo PC'), findsWidgets);
  });
}
