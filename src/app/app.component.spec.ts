import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('should create the app', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [AppComponent]
    }).createComponent(AppComponent);

    expect(fixture.componentInstance).toBeTruthy();
  });
});
